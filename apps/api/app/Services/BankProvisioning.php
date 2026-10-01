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
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
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

            $this->revokePendingAdminInvitations($bank);

            $invitation = $this->issueAdminInvitation($bank, $previous?->name ?? $bank->admin_email, $actor, $token);

            AuditLog::record('bank.admin_invitation_resent', $bank, $bank->id, null, [
                'admin_email' => $bank->admin_email,
                'replaced_invitation_id' => $previous?->id,
            ]);

            return [$bank, $invitation];
        }, attempts: 3);

        return $this->deliver($bank, $invitation, $token);
    }

    /**
     * Corrects the administrator's name and email. For an accepted administrator this edits their
     * global identity; for a pending one, a new email gets a fresh invitation and old links stop working.
     *
     * @return array{bank: Bank, accept_url: string|null, email_sent: bool|null}
     *
     * @throws DomainRuleException
     */
    public function updateAdministrator(Bank $bank, string $name, string $email, User $actor): array
    {
        $email = User::normalizeEmail($email);
        $token = null;

        try {
            [$bank, $invitation] = DB::transaction(function () use ($bank, $name, $email, $actor, &$token) {
                $bank = Bank::whereKey($bank->id)->lockForUpdate()->firstOrFail();
                $admin = $bank->admin;
                $previous = $admin ? ['name' => $admin->name, 'email' => $admin->email] : ['name' => $bank->adminInvitation?->name, 'email' => $bank->admin_email];
                $emailChanged = $email !== $previous['email'];

                if ($emailChanged) {
                    $this->assertEmailCanAdminister($email, $bank);
                }

                $invitation = null;

                if ($admin) {
                    if ($emailChanged && User::where('email', $email)->whereKeyNot($admin->id)->exists()) {
                        throw new DomainRuleException('email', 'Ya existe otra cuenta con ese email.');
                    }

                    $admin->forceFill(['name' => $name, 'email' => $email])->save();
                    $bank->forceFill(['admin_email' => $email])->save();

                    if ($emailChanged) {
                        // They sign in with the new address from now on; invitations still pending for the
                        // old one follow the identity so accepting them cannot create a second user.
                        $admin->tokens()->delete();
                        app(PushNotifications::class)->forget($admin);
                        Invitation::where('email', $previous['email'])
                            ->whereNull('accepted_at')
                            ->whereNull('revoked_at')
                            ->update(['email' => $email]);
                    }
                } elseif ($emailChanged) {
                    if ($bank->status === BankStatus::Deactivated) {
                        throw new DomainRuleException('email', 'El banco está desactivado: no se puede invitar a otro administrador.');
                    }

                    $bank->forceFill(['admin_email' => $email])->save();
                    $this->revokePendingAdminInvitations($bank);
                    $token = Invitation::newToken();
                    $invitation = $this->issueAdminInvitation($bank, $name, $actor, $token);
                } else {
                    $bank->adminInvitation?->forceFill(['name' => $name])->save();
                }

                AuditLog::record('bank.admin_updated', $admin ?? $bank, $bank->id, $previous, ['name' => $name, 'email' => $email]);

                return [$bank, $invitation];
            }, attempts: 3);
        } catch (UniqueConstraintViolationException) {
            // Another account or bank took the email at the same moment.
            throw new DomainRuleException('email', 'Ese email ya está en uso.');
        }

        if ($invitation && $token) {
            $delivered = $this->deliver($bank, $invitation, $token);

            return ['bank' => $bank, 'accept_url' => $delivered['accept_url'], 'email_sent' => $delivered['email_sent']];
        }

        return ['bank' => $bank, 'accept_url' => null, 'email_sent' => null];
    }

    /**
     * Sets the administrator's password, chosen by the superadmin, and signs them out everywhere.
     * The password belongs to the shared identity, so it also applies to their client access.
     *
     * @throws DomainRuleException when the invitation has not been accepted yet.
     */
    public function setAdministratorPassword(Bank $bank, string $password): void
    {
        DB::transaction(function () use ($bank, $password) {
            $bank = Bank::whereKey($bank->id)->lockForUpdate()->firstOrFail();
            $admin = $bank->admin;

            if (! $admin) {
                throw new DomainRuleException('password', 'El administrador todavía no aceptó la invitación.');
            }

            $admin->forceFill(['password' => Hash::make($password)])->save();
            $admin->tokens()->delete();
            app(PushNotifications::class)->forget($admin);
            // An unused reset link must not override the password just set.
            Password::broker()->deleteToken($admin);

            // The password itself is never recorded.
            AuditLog::record('bank.admin_password_set', $admin, $bank->id);
        });
    }

    private function revokePendingAdminInvitations(Bank $bank): void
    {
        $bank->invitations()
            ->where('type', InvitationType::BankAdmin)
            ->whereNull('accepted_at')
            ->whereNull('revoked_at')
            ->update(['revoked_at' => now()]);
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

    private function assertEmailCanAdminister(string $email, ?Bank $except = null): void
    {
        $otherBanks = fn () => Bank::query()->when($except, fn ($query) => $query->whereKeyNot($except->id));
        $alreadyAssigned = $otherBanks()->where('admin_email', $email)->exists()
            || $otherBanks()->whereHas('admin', fn ($query) => $query->where('email', $email))->exists();

        if ($alreadyAssigned) {
            throw $this->emailTaken($except ? 'email' : 'admin_email');
        }
    }

    private function emailTaken(string $field = 'admin_email'): DomainRuleException
    {
        return new DomainRuleException(
            $field,
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
