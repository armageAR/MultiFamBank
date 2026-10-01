<?php

namespace Tests\Feature;

use App\Enums\BankStatus;
use App\Enums\InvitationType;
use App\Models\Bank;
use App\Models\Invitation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InvitationAcceptanceTest extends TestCase
{
    use RefreshDatabase;

    /** @return array{0: Bank, 1: Invitation, 2: string} */
    private function invite(string $email = 'laura@example.com', InvitationType $type = InvitationType::BankAdmin, ?Bank $bank = null): array
    {
        $bank ??= Bank::create(['admin_email' => $email, 'status' => BankStatus::PendingConfiguration]);
        $token = Invitation::newToken();
        $invitation = $bank->invitations()->create([
            'type' => $type,
            'email' => $email,
            'name' => 'Laura',
            'token_hash' => Invitation::hashToken($token),
            'expires_at' => now()->addDays(7),
        ]);

        return [$bank, $invitation, $token];
    }

    public function test_show_describes_the_invitation(): void
    {
        [, , $token] = $this->invite();

        $this->getJson("/api/invitations/$token")
            ->assertOk()
            ->assertJsonPath('type', 'bank_admin')
            ->assertJsonPath('state', 'pending')
            ->assertJsonPath('email', 'laura@example.com')
            ->assertJsonPath('has_account', false);

        $this->getJson('/api/invitations/unknown')->assertNotFound();
    }

    public function test_a_new_administrator_registers_and_is_assigned_to_the_bank(): void
    {
        [$bank, $invitation, $token] = $this->invite();

        $response = $this->postJson("/api/invitations/$token/accept", [
            'name' => 'Laura Pérez',
            'password' => 'clave-segura-1',
            'password_confirmation' => 'clave-segura-1',
        ]);

        $response->assertOk()->assertJsonPath('user.administered_bank.status', 'pending_configuration');

        $user = User::where('email', 'laura@example.com')->sole();
        $this->assertSame('Laura Pérez', $user->name);
        $this->assertNotNull($user->email_verified_at);
        $this->assertSame($user->id, $bank->fresh()->admin_user_id);
        $this->assertNotNull($invitation->fresh()->accepted_at);
        $this->assertSame(BankStatus::PendingConfiguration, $bank->fresh()->status);

        $this->withToken($response->json('token'))->getJson('/api/admin/bank')->assertOk();
    }

    public function test_an_invitation_can_be_accepted_only_once(): void
    {
        [, , $token] = $this->invite();
        $payload = ['name' => 'Laura', 'password' => 'clave-segura-1', 'password_confirmation' => 'clave-segura-1'];

        $this->postJson("/api/invitations/$token/accept", $payload)->assertOk();
        $this->postJson("/api/invitations/$token/accept", ['password' => 'clave-segura-1'])
            ->assertJsonValidationErrors('token');

        $this->assertSame(1, User::count());
    }

    public function test_an_expired_invitation_is_rejected(): void
    {
        [, $invitation, $token] = $this->invite();
        $invitation->update(['expires_at' => now()->subMinute()]);

        $this->getJson("/api/invitations/$token")->assertJsonPath('state', 'expired');
        $this->postJson("/api/invitations/$token/accept", [
            'name' => 'Laura', 'password' => 'clave-segura-1', 'password_confirmation' => 'clave-segura-1',
        ])->assertJsonValidationErrors('token');

        $this->assertSame(0, User::count());
    }

    public function test_an_existing_identity_accepts_with_its_password_without_duplicating_the_user(): void
    {
        $user = User::factory()->create(['email' => 'laura@example.com']);
        [$bank, , $token] = $this->invite();

        $this->getJson("/api/invitations/$token")->assertJsonPath('has_account', true);
        $this->postJson("/api/invitations/$token/accept", ['password' => 'wrong'])->assertJsonValidationErrors('password');
        $this->postJson("/api/invitations/$token/accept", ['password' => 'password'])->assertOk();

        $this->assertSame(1, User::count());
        $this->assertSame($user->id, $bank->fresh()->admin_user_id);
    }

    public function test_a_person_cannot_administer_two_banks(): void
    {
        $user = User::factory()->create(['email' => 'laura@example.com']);
        Bank::create(['admin_email' => 'laura-old@example.com', 'admin_user_id' => $user->id, 'status' => BankStatus::Active]);
        [$bank, $invitation, $token] = $this->invite();

        $this->postJson("/api/invitations/$token/accept", ['password' => 'password'])->assertJsonValidationErrors('token');

        $this->assertNull($bank->fresh()->admin_user_id);
        $this->assertNull($invitation->fresh()->accepted_at);
    }

    public function test_a_client_invitation_creates_one_membership_and_savings_account(): void
    {
        $user = User::factory()->create(['email' => 'nico@example.com']);
        $bank = Bank::create(['name' => 'Familia', 'admin_email' => 'admin@example.com', 'status' => BankStatus::Active]);
        [, , $first] = $this->invite('nico@example.com', InvitationType::BankClient, $bank);
        [, , $second] = $this->invite('nico@example.com', InvitationType::BankClient, $bank);

        $this->postJson("/api/invitations/$first/accept", ['password' => 'password'])->assertOk();
        $this->postJson("/api/invitations/$second/accept", ['password' => 'password'])->assertOk();

        $this->assertSame(1, $bank->memberships()->where('user_id', $user->id)->count());
        $this->assertSame(1, $bank->memberships()->sole()->savingsAccount()->count());
    }

    public function test_invitations_to_a_deactivated_bank_cannot_be_accepted(): void
    {
        [$bank, , $token] = $this->invite();
        $bank->update(['status' => BankStatus::Deactivated]);

        $this->postJson("/api/invitations/$token/accept", [
            'name' => 'Laura', 'password' => 'clave-segura-1', 'password_confirmation' => 'clave-segura-1',
        ])->assertNotFound();

        $this->assertSame(0, User::count());
    }

    public function test_client_invitations_require_an_active_bank(): void
    {
        User::factory()->create(['email' => 'nico@example.com']);
        $bank = Bank::create(['name' => 'Familia', 'admin_email' => 'admin@example.com', 'status' => BankStatus::Paused]);
        [, , $token] = $this->invite('nico@example.com', InvitationType::BankClient, $bank);

        $this->postJson("/api/invitations/$token/accept", ['password' => 'password'])->assertJsonValidationErrors('token');
        $this->assertSame(0, $bank->memberships()->count());
    }
}
