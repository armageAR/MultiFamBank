<?php

namespace App\Services;

use App\Enums\BankStatus;
use App\Enums\InvitationType;
use App\Exceptions\DomainRuleException;
use App\Mail\BankAdminInvitationMail;
use App\Models\AuditLog;
use App\Models\Bank;
use App\Models\Invitation;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * @phpstan-type IssuedInvitation array{bank: Bank, invitation: Invitation, accept_url: string, email_sent: bool}
 */
class BankProvisioning
{
    /**
     * Creates a bank pending configuration and invites its administrator.
     *
     * @return IssuedInvitation
     *
     * @throws DomainRuleException when the email already administers a bank or has a pending invitation.
     */
    public function createWithAdminInvitation(string $adminEmail, string $adminName, User $actor): array
    {
        $email = User::normalizeEmail($adminEmail);
        $this->assertEmailCanAdminister($email);

        $token = Invitation::newToken();

        try {
            [$bank, $invitation] = DB::transaction(function () use ($email, $adminName, $actor, $token) {
                $bank = Bank::create([
                    'status' => BankStatus::PendingConfiguration,
                    'admin_email' => $email,
                    'created_by' => $actor->id,
                ]);

                $invitation = $this->issueAdminInvitation($bank, $adminName, $actor, $token);

                AuditLog::record('bank.created', $bank, $bank->id, null, [
                    'admin_email' => $email,
                    'admin_name' => $adminName,
                ]);

                return [$bank, $invitation];
            });
        } catch (UniqueConstraintViolationException) {
            // A concurrent request assigned the same email first.
            throw $this->emailTaken();
        }

        return $this->deliver($bank, $invitation, $token);
    }

    /**
     * Replaces the administrator invitation of a bank nobody has accepted yet: previous
     * invitations stop working and a new link is issued. No bank or user is created.
     *
     * @return IssuedInvitation
     *
     * @throws DomainRuleException when the bank already has an administrator or is deactivated.
     */
    public function resendAdminInvitation(Bank $bank, User $actor): array
    {
        $token = Invitation::newToken();

        [$bank, $invitation] = DB::transaction(function () use ($bank, $actor, $token) {
            $bank = Bank::whereKey($bank->id)->lockForUpdate()->firstOrFail();

            if ($bank->admin_user_id !== null) {
                throw new DomainRuleException('bank', 'El administrador ya aceptó la invitación.');
            }

            if ($bank->status === BankStatus::Deactivated) {
                throw new DomainRuleException('bank', 'El banco está desactivado.');
            }

            $previous = $bank->adminInvitation;

            $bank->invitations()
                ->where('type', InvitationType::BankAdmin)
                ->whereNull('accepted_at')
                ->whereNull('revoked_at')
                ->update(['revoked_at' => now()]);

            $invitation = $this->issueAdminInvitation($bank, $previous?->name ?? $bank->admin_email, $actor, $token);

            AuditLog::record('bank.admin_invitation_resent', $bank, $bank->id, null, [
                'admin_email' => $bank->admin_email,
                'replaced_invitation_id' => $previous?->id,
            ]);

            return [$bank, $invitation];
        }, attempts: 3);

        return $this->deliver($bank, $invitation, $token);
    }

    private function issueAdminInvitation(Bank $bank, string $adminName, User $actor, string $token): Invitation
    {
        return $bank->invitations()->create([
            'type' => InvitationType::BankAdmin,
            'email' => $bank->admin_email,
            'name' => $adminName,
            'token_hash' => Invitation::hashToken($token),
            'invited_by' => $actor->id,
            'expires_at' => now()->addDays(config('multifambank.invitation_ttl_days')),
        ]);
    }

    private function assertEmailCanAdminister(string $email): void
    {
        $alreadyAssigned = Bank::where('admin_email', $email)->exists()
            || Bank::whereHas('admin', fn ($query) => $query->where('email', $email))->exists();

        if ($alreadyAssigned) {
            throw $this->emailTaken();
        }
    }

    private function emailTaken(): DomainRuleException
    {
        return new DomainRuleException(
            'admin_email',
            'Este email ya administra un banco o tiene una invitación de administrador pendiente.',
        );
    }

    /**
     * The bank and invitation are already committed; a delivery failure is reported, not rolled back.
     *
     * @return IssuedInvitation
     */
    private function deliver(Bank $bank, Invitation $invitation, string $token): array
    {
        $acceptUrl = InvitationLinks::acceptUrl($invitation, $token);

        try {
            Mail::to($invitation->email, $invitation->name)->send(new BankAdminInvitationMail($invitation, $acceptUrl));
            $invitation->forceFill(['last_sent_at' => now(), 'send_count' => $invitation->send_count + 1])->save();
            $emailSent = true;
        } catch (Throwable $e) {
            Log::error('Bank admin invitation email failed', ['invitation_id' => $invitation->id, 'error' => $e->getMessage()]);
            $emailSent = false;
        }

        return ['bank' => $bank, 'invitation' => $invitation, 'accept_url' => $acceptUrl, 'email_sent' => $emailSent];
    }
}
