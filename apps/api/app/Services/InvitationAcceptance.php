<?php

namespace App\Services;

use App\Enums\BankStatus;
use App\Enums\InvitationType;
use App\Enums\MembershipStatus;
use App\Exceptions\DomainRuleException;
use App\Models\AuditLog;
use App\Models\Bank;
use App\Models\Invitation;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class InvitationAcceptance
{
    /**
     * Accepts an invitation once. New emails register with a password; existing identities
     * confirm with their current password, so no duplicate user is ever created.
     *
     * @param  array{name?: string|null, password: string}  $input
     *
     * @throws DomainRuleException
     */
    public function accept(string $token, array $input): User
    {
        try {
            return $this->acceptInTransaction($token, $input);
        } catch (UniqueConstraintViolationException) {
            // Another invitation for the same person was accepted at the same moment. Nothing was
            // written; retrying takes the existing-identity path.
            throw new DomainRuleException('token', 'No pudimos completar la aceptación. Volvé a intentarlo.');
        }
    }

    private function acceptInTransaction(string $token, array $input): User
    {
        return DB::transaction(function () use ($token, $input) {
            $invitation = Invitation::where('token_hash', Invitation::hashToken($token))->lockForUpdate()->first();

            if (! $invitation) {
                throw new DomainRuleException('token', 'La invitación no existe.');
            }

            if (! $invitation->isAcceptable()) {
                throw new DomainRuleException('token', match ($invitation->state()) {
                    'accepted' => 'Esta invitación ya fue aceptada.',
                    'expired' => 'Esta invitación venció. Pedí que te la reenvíen.',
                    default => 'Esta invitación ya no es válida.',
                });
            }

            $bank = Bank::whereKey($invitation->bank_id)->lockForUpdate()->firstOrFail();

            if ($bank->status === BankStatus::Deactivated
                || ($invitation->type === InvitationType::BankClient && $bank->status !== BankStatus::Active)) {
                throw new DomainRuleException('token', 'El banco no está disponible en este momento.');
            }

            $user = $this->resolveUser($invitation, $input);

            match ($invitation->type) {
                InvitationType::BankAdmin => $this->assignAdministrator($bank, $user),
                InvitationType::BankClient => $this->addClient($bank, $user),
            };

            $invitation->forceFill(['accepted_at' => now(), 'accepted_by' => $user->id])->save();

            AuditLog::record('invitation.accepted', $invitation, $bank->id, null, [
                'type' => $invitation->type->value,
                'user_id' => $user->id,
            ]);

            return $user;
        });
    }

    private function resolveUser(Invitation $invitation, array $input): User
    {
        $user = User::where('email', $invitation->email)->first();

        if (! $user) {
            return User::create([
                'name' => $input['name'] ?? $invitation->name,
                'email' => $invitation->email,
                'password' => $input['password'],
                // Following the emailed link proves control of the address.
                'email_verified_at' => now(),
            ]);
        }

        if (! $user->active || ! Hash::check($input['password'], $user->password)) {
            throw new DomainRuleException('password', 'La contraseña no es correcta.');
        }

        return $user;
    }

    private function assignAdministrator(Bank $bank, User $user): void
    {
        if ($bank->admin_user_id !== null) {
            throw new DomainRuleException('token', 'Este banco ya tiene administrador.');
        }

        if (Bank::where('admin_user_id', $user->id)->exists()) {
            throw new DomainRuleException('token', 'Ya administrás otro banco. Una persona puede administrar un solo banco.');
        }

        $bank->forceFill(['admin_user_id' => $user->id])->save();
    }

    private function addClient(Bank $bank, User $user): void
    {
        $membership = $bank->memberships()->firstOrCreate(
            ['user_id' => $user->id],
            ['status' => MembershipStatus::Active],
        );

        if ($membership->status !== MembershipStatus::Active) {
            $membership->forceFill(['status' => MembershipStatus::Active])->save();
        }

        $membership->savingsAccount()->firstOrCreate([], ['bank_id' => $bank->id]);
    }
}
