<?php

namespace App\Services;

use App\Enums\BankStatus;
use App\Enums\InvitationType;
use App\Enums\MembershipStatus;
use App\Enums\MoneyRequestStatus;
use App\Exceptions\DomainRuleException;
use App\Mail\ClientInvitationMail;
use App\Models\AuditLog;
use App\Models\Bank;
use App\Models\BankMembership;
use App\Models\Invitation;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Throwable;

/** What a bank administrator can do with the bank's clients. */
class ClientManagement
{
    /**
     * Invites someone to be a client. Existing identities are reused when they accept; a repeated
     * invitation to the same email replaces the previous link.
     *
     * @return array{invitation: Invitation, accept_url: string, email_sent: bool}
     */
    public function invite(Bank $bank, string $email, string $name, User $admin): array
    {
        $email = User::normalizeEmail($email);
        $token = Invitation::newToken();

        $invitation = DB::transaction(function () use ($bank, $email, $name, $admin, $token) {
            $bank = $this->lockActive($bank);

            if ($email === User::normalizeEmail($admin->email)) {
                throw new DomainRuleException('email', 'No podés invitarte como cliente de tu propio banco.');
            }

            $alreadyClient = $bank->memberships()
                ->where('status', MembershipStatus::Active)
                ->whereHas('user', fn ($query) => $query->where('email', $email))
                ->exists();

            if ($alreadyClient) {
                throw new DomainRuleException('email', 'Esa persona ya es cliente del banco.');
            }

            $this->pendingClientInvitations($bank, $email)->update(['revoked_at' => now()]);

            $invitation = $bank->invitations()->create([
                'type' => InvitationType::BankClient,
                'email' => $email,
                'name' => $name,
                'token_hash' => Invitation::hashToken($token),
                'invited_by' => $admin->id,
                'expires_at' => now()->addDays(config('multifambank.invitation_ttl_days')),
            ]);

            AuditLog::record('client.invited', $invitation, $bank->id, null, ['email' => $email, 'name' => $name]);

            return $invitation;
        });

        $acceptUrl = InvitationLinks::acceptUrl($invitation, $token);

        return ['invitation' => $invitation, 'accept_url' => $acceptUrl, 'email_sent' => $this->send($invitation, $acceptUrl)];
    }

    /** @return array{invitation: Invitation, accept_url: string, email_sent: bool} */
    public function resend(Invitation $invitation, User $admin): array
    {
        if ($invitation->state() === 'accepted') {
            throw new DomainRuleException('invitation', 'La invitación ya fue aceptada.');
        }

        return $this->invite($invitation->bank, $invitation->email, $invitation->name, $admin);
    }

    public function revoke(Invitation $invitation): void
    {
        DB::transaction(function () use ($invitation) {
            $this->lockActive($invitation->bank);
            $invitation = Invitation::whereKey($invitation->id)->lockForUpdate()->firstOrFail();

            if ($invitation->accepted_at !== null) {
                throw new DomainRuleException('invitation', 'La invitación ya fue aceptada.');
            }

            $invitation->forceFill(['revoked_at' => $invitation->revoked_at ?? now()])->save();
            AuditLog::record('client.invitation_revoked', $invitation, $invitation->bank_id);
        });
    }

    /**
     * Name and email are the person's global identity. An administrator may only change them for
     * someone who belongs to no other bank; otherwise the person updates them.
     */
    public function update(BankMembership $membership, string $name, string $email): User
    {
        $email = User::normalizeEmail($email);

        try {
            return DB::transaction(function () use ($membership, $name, $email) {
                $this->lockActive($membership->bank);
                $user = User::whereKey($membership->user_id)->lockForUpdate()->firstOrFail();
                $this->assertManagedOnlyHere($membership, $user);

                if ($email !== $user->email && User::where('email', $email)->whereKeyNot($user->id)->exists()) {
                    throw new DomainRuleException('email', 'Ya existe otra cuenta con ese email.');
                }

                $before = ['name' => $user->name, 'email' => $user->email];
                $emailChanged = $email !== $user->email;
                $user->forceFill(['name' => $name, 'email' => $email])->save();

                if ($emailChanged) {
                    // The admin vouches for the new address, but it is not verified by the person.
                    $user->forceFill(['email_verified_at' => null])->save();
                    $user->tokens()->delete();
                    app(PushNotifications::class)->forget($user);
                }

                AuditLog::record('client.updated', $user, $membership->bank_id, $before, ['name' => $name, 'email' => $email]);

                return $user;
            });
        } catch (UniqueConstraintViolationException) {
            throw new DomainRuleException('email', 'Ese email ya está en uso.');
        }
    }

    /** As in FamBank, the administrator can set a client's password (only for clients of this bank alone). */
    public function setPassword(BankMembership $membership, string $password): void
    {
        DB::transaction(function () use ($membership, $password) {
            $this->lockActive($membership->bank);
            $user = User::whereKey($membership->user_id)->lockForUpdate()->firstOrFail();
            $this->assertManagedOnlyHere($membership, $user);

            $user->forceFill(['password' => Hash::make($password)])->save();
            $user->tokens()->delete();
            app(PushNotifications::class)->forget($user);
            Password::broker()->deleteToken($user);

            AuditLog::record('client.password_set', $user, $membership->bank_id);
        });
    }

    /** Sends the client a link to choose a new password; works for any client. */
    public function sendPasswordReset(BankMembership $membership): void
    {
        $this->assertActive($membership->bank);
        Password::sendResetLink(['email' => $membership->user->email]);
        AuditLog::record('client.password_reset_sent', $membership->user, $membership->bank_id);
    }

    /** Removes access to this bank. Balances and history stay; pending requests must be resolved first. */
    public function deactivate(BankMembership $membership): BankMembership
    {
        return DB::transaction(function () use ($membership) {
            $this->lockActive($membership->bank);
            $membership = BankMembership::whereKey($membership->id)->lockForUpdate()->firstOrFail();

            if ($membership->status === MembershipStatus::Removed) {
                throw new DomainRuleException('membership', 'Ya está dado de baja.');
            }

            if ($membership->bank->moneyRequests()->where('bank_membership_id', $membership->id)->where('status', MoneyRequestStatus::Pending)->exists()) {
                throw new DomainRuleException('membership', 'Tiene pedidos pendientes: confirmalos o rechazalos antes de darlo de baja.');
            }

            $membership->forceFill(['status' => MembershipStatus::Removed])->save();
            AuditLog::record('client.deactivated', $membership, $membership->bank_id);

            return $membership;
        });
    }

    public function reactivate(BankMembership $membership): BankMembership
    {
        return DB::transaction(function () use ($membership) {
            $this->lockActive($membership->bank);
            $membership = BankMembership::whereKey($membership->id)->lockForUpdate()->firstOrFail();
            $membership->forceFill(['status' => MembershipStatus::Active])->save();
            AuditLog::record('client.reactivated', $membership, $membership->bank_id);

            return $membership;
        });
    }

    /** Whether the administrator of this bank may edit the person's identity or password. */
    public function managedOnlyHere(BankMembership $membership, User $user): bool
    {
        return ! $user->is_superadmin
            && ! Bank::where('admin_user_id', $user->id)->exists()
            && ! BankMembership::where('user_id', $user->id)->whereKeyNot($membership->id)->exists();
    }

    private function assertManagedOnlyHere(BankMembership $membership, User $user): void
    {
        if (! $this->managedOnlyHere($membership, $user)) {
            throw new DomainRuleException('client', 'Esta persona también usa MultiFamBank en otro banco: solo ella puede cambiar sus datos o su contraseña. Podés enviarle un link para restablecer la contraseña.');
        }
    }

    private function lockActive(Bank $bank): Bank
    {
        $bank = Bank::whereKey($bank->id)->sharedLock()->firstOrFail();
        $this->assertActive($bank);

        return $bank;
    }

    private function assertActive(Bank $bank): void
    {
        if ($bank->status !== BankStatus::Active) {
            throw new DomainRuleException('bank', $bank->status === BankStatus::Paused
                ? 'Las operaciones del banco están pausadas. Comunicate con el administrador de la plataforma.'
                : 'El banco no está disponible.');
        }
    }

    private function pendingClientInvitations(Bank $bank, string $email)
    {
        return $bank->invitations()
            ->where('type', InvitationType::BankClient)
            ->where('email', $email)
            ->whereNull('accepted_at')
            ->whereNull('revoked_at');
    }

    private function send(Invitation $invitation, string $acceptUrl): bool
    {
        try {
            Mail::to($invitation->email, $invitation->name)->send(new ClientInvitationMail($invitation, $acceptUrl));
            $invitation->forceFill(['last_sent_at' => now(), 'send_count' => $invitation->send_count + 1])->save();

            return true;
        } catch (Throwable $e) {
            Log::error('Client invitation email failed', ['invitation_id' => $invitation->id, 'error' => $e->getMessage()]);

            return false;
        }
    }
}
