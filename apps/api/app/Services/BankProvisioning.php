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

class BankProvisioning
{
    /**
     * Creates a bank pending configuration and invites its administrator.
     *
     * @return array{bank: Bank, invitation: Invitation, accept_url: string, email_sent: bool}
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

                $invitation = $bank->invitations()->create([
                    'type' => InvitationType::BankAdmin,
                    'email' => $email,
                    'name' => $adminName,
                    'token_hash' => Invitation::hashToken($token),
                    'invited_by' => $actor->id,
                    'expires_at' => now()->addDays(config('multifambank.invitation_ttl_days')),
                ]);

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

        $acceptUrl = InvitationLinks::acceptUrl($invitation, $token);
        $emailSent = $this->send($invitation, $acceptUrl);

        return ['bank' => $bank, 'invitation' => $invitation, 'accept_url' => $acceptUrl, 'email_sent' => $emailSent];
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

    /** The bank and invitation are already committed; a delivery failure is reported, not rolled back. */
    private function send(Invitation $invitation, string $acceptUrl): bool
    {
        try {
            Mail::to($invitation->email, $invitation->name)->send(new BankAdminInvitationMail($invitation, $acceptUrl));
        } catch (Throwable $e) {
            Log::error('Bank admin invitation email failed', ['invitation_id' => $invitation->id, 'error' => $e->getMessage()]);

            return false;
        }

        $invitation->forceFill(['last_sent_at' => now(), 'send_count' => $invitation->send_count + 1])->save();

        return true;
    }
}
