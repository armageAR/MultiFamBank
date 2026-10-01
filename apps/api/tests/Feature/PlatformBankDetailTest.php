<?php

namespace Tests\Feature;

use App\Enums\BankStatus;
use App\Enums\InvitationType;
use App\Mail\BankAdminInvitationMail;
use App\Models\AuditLog;
use App\Models\Bank;
use App\Models\Invitation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PlatformBankDetailTest extends TestCase
{
    use RefreshDatabase;

    private User $superadmin;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        $this->superadmin = User::factory()->superadmin()->create();
    }

    private function activeBank(): array
    {
        $admin = User::factory()->create(['name' => 'Laura', 'email' => 'laura@example.com']);
        $bank = Bank::create(['name' => 'Familia', 'admin_email' => $admin->email, 'admin_user_id' => $admin->id, 'status' => BankStatus::Active]);

        return [$bank, $admin];
    }

    private function pendingBank(string $email = 'pending@example.com'): Bank
    {
        Sanctum::actingAs($this->superadmin);
        $this->postJson('/api/platform/banks', ['admin_email' => $email, 'admin_name' => 'Pendiente'])->assertCreated();

        return Bank::where('admin_email', $email)->sole();
    }

    public function test_detail_shows_the_administrator_and_clients_with_last_activity(): void
    {
        [$bank, $admin] = $this->activeBank();
        $admin->forceFill(['last_seen_at' => now()->subHour()])->save();
        $zoe = User::factory()->create(['name' => 'Zoe', 'last_seen_at' => now()->subDay()]);
        $ana = User::factory()->create(['name' => 'ana']);
        $bank->memberships()->create(['user_id' => $zoe->id]);
        $bank->memberships()->create(['user_id' => $ana->id]);
        Sanctum::actingAs($this->superadmin);

        $this->getJson("/api/platform/banks/{$bank->id}")
            ->assertOk()
            ->assertJsonPath('data.name', 'Familia')
            ->assertJsonPath('data.admin.name', 'Laura')
            ->assertJsonPath('data.admin.last_seen_at', $admin->last_seen_at->toJSON())
            ->assertJsonCount(2, 'data.clients')
            ->assertJsonPath('data.clients.0.name', 'ana')
            ->assertJsonPath('data.clients.0.last_seen_at', null)
            ->assertJsonPath('data.clients.1.name', 'Zoe')
            ->assertJsonPath('data.clients.1.status', 'active')
            ->assertJsonMissingPath('data.clients.0.balance_usd');
    }

    public function test_only_the_superadmin_can_see_or_change_a_bank(): void
    {
        [$bank, $admin] = $this->activeBank();
        Sanctum::actingAs($admin);

        $this->getJson("/api/platform/banks/{$bank->id}")->assertForbidden();
        $this->patchJson("/api/platform/banks/{$bank->id}/admin", ['name' => 'X', 'email' => 'x@example.com'])->assertForbidden();
        $this->putJson("/api/platform/banks/{$bank->id}/admin/password", ['password' => 'nueva-clave', 'password_confirmation' => 'nueva-clave'])->assertForbidden();
    }

    public function test_editing_an_accepted_administrator_updates_their_identity(): void
    {
        [$bank, $admin] = $this->activeBank();
        Sanctum::actingAs($this->superadmin);

        $this->patchJson("/api/platform/banks/{$bank->id}/admin", ['name' => 'Laura Gómez', 'email' => 'LAURA.G@example.com'])
            ->assertOk()
            ->assertJsonPath('data.admin.name', 'Laura Gómez')
            ->assertJsonPath('data.admin.email', 'laura.g@example.com')
            ->assertJsonPath('invitation_url', null);

        $this->assertSame('laura.g@example.com', $admin->fresh()->email);
        $this->assertSame('laura.g@example.com', $bank->fresh()->admin_email);
        Mail::assertNothingSent();
        $this->assertDatabaseHas('audit_logs', ['action' => 'bank.admin_updated', 'bank_id' => $bank->id]);
    }

    public function test_an_email_used_by_another_account_or_bank_is_rejected(): void
    {
        [$bank] = $this->activeBank();
        User::factory()->create(['email' => 'taken@example.com']);
        $this->pendingBank('reserved@example.com');

        $this->patchJson("/api/platform/banks/{$bank->id}/admin", ['name' => 'Laura', 'email' => 'taken@example.com'])
            ->assertJsonValidationErrors('email');
        $this->patchJson("/api/platform/banks/{$bank->id}/admin", ['name' => 'Laura', 'email' => 'reserved@example.com'])
            ->assertJsonValidationErrors('email');

        $this->assertSame('laura@example.com', $bank->fresh()->admin_email);
    }

    public function test_changing_a_pending_administrators_email_reissues_the_invitation(): void
    {
        config(['multifambank.expose_invitation_links' => true]);
        $bank = $this->pendingBank();
        $oldInvitation = $bank->adminInvitation;

        $response = $this->patchJson("/api/platform/banks/{$bank->id}/admin", ['name' => 'Nuevo Nombre', 'email' => 'nuevo@example.com']);

        $response->assertOk()
            ->assertJsonPath('data.admin.email', 'nuevo@example.com')
            ->assertJsonPath('data.admin.name', 'Nuevo Nombre')
            ->assertJsonPath('email_sent', true);
        $this->assertStringContainsString('/invitacion/', $response->json('invitation_url'));
        $this->assertNotNull($oldInvitation->fresh()->revoked_at);
        $this->assertSame('nuevo@example.com', $bank->fresh()->adminInvitation->email);
        Mail::assertSent(BankAdminInvitationMail::class, fn ($mail) => $mail->hasTo('nuevo@example.com'));
    }

    public function test_renaming_a_pending_administrator_keeps_the_invitation(): void
    {
        $bank = $this->pendingBank();

        $this->patchJson("/api/platform/banks/{$bank->id}/admin", ['name' => 'Otro Nombre', 'email' => 'pending@example.com'])
            ->assertOk()
            ->assertJsonPath('data.admin.name', 'Otro Nombre')
            ->assertJsonPath('invitation_url', null);

        $this->assertSame(1, Invitation::count());
        $this->assertNull($bank->fresh()->adminInvitation->revoked_at);
    }

    public function test_the_superadmin_can_set_the_administrator_password(): void
    {
        [$bank, $admin] = $this->activeBank();
        $admin->createToken('old-session');
        Sanctum::actingAs($this->superadmin);

        $this->putJson("/api/platform/banks/{$bank->id}/admin/password", ['password' => 'clave-nueva-1', 'password_confirmation' => 'clave-nueva-1'])
            ->assertOk();

        $this->assertTrue(Hash::check('clave-nueva-1', $admin->fresh()->password));
        $this->assertSame(0, $admin->tokens()->count());
        $this->assertDatabaseHas('audit_logs', ['action' => 'bank.admin_password_set', 'bank_id' => $bank->id]);
        $this->assertStringNotContainsString('clave-nueva-1', (string) AuditLog::where('action', 'bank.admin_password_set')->sole()->toJson());
    }

    public function test_password_validation_and_pending_administrators(): void
    {
        $bank = $this->pendingBank();

        $this->putJson("/api/platform/banks/{$bank->id}/admin/password", ['password' => 'corta', 'password_confirmation' => 'otra'])
            ->assertJsonValidationErrors('password');
        $this->putJson("/api/platform/banks/{$bank->id}/admin/password", ['password' => 'clave-nueva-1', 'password_confirmation' => 'clave-nueva-1'])
            ->assertJsonValidationErrors('password');
    }

    public function test_authenticated_requests_record_last_activity_at_most_every_five_minutes(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('web')->plainTextToken;

        $this->withToken($token)->getJson('/api/auth/me')->assertOk();
        $first = $user->fresh()->last_seen_at;
        $this->assertNotNull($first);

        $this->travel(2)->minutes();
        $this->withToken($token)->getJson('/api/auth/me')->assertOk();
        $this->assertEquals($first, $user->fresh()->last_seen_at);

        $this->travel(4)->minutes();
        $this->withToken($token)->getJson('/api/auth/me')->assertOk();
        $this->assertTrue($user->fresh()->last_seen_at->gt($first));

        $this->getJson('/api/health')->assertOk();
    }

    public function test_a_deactivated_bank_cannot_invite_a_different_administrator(): void
    {
        $bank = $this->pendingBank();
        $bank->update(['status' => BankStatus::Deactivated]);

        $this->patchJson("/api/platform/banks/{$bank->id}/admin", ['name' => 'Pendiente', 'email' => 'otro@example.com'])
            ->assertJsonValidationErrors('email');

        $this->assertSame(1, Invitation::count());
        Mail::assertSentCount(1);
    }

    public function test_changing_an_accepted_administrators_email_signs_them_out_and_moves_pending_invitations(): void
    {
        [$bank, $admin] = $this->activeBank();
        $admin->createToken('session');
        $other = Bank::create(['name' => 'Otra', 'admin_email' => 'otro-admin@example.com', 'status' => BankStatus::Active]);
        $clientInvite = $other->invitations()->create([
            'type' => InvitationType::BankClient,
            'email' => 'laura@example.com',
            'name' => 'Laura',
            'token_hash' => Invitation::hashToken('client-token'),
            'expires_at' => now()->addDay(),
        ]);
        Sanctum::actingAs($this->superadmin);

        $this->patchJson("/api/platform/banks/{$bank->id}/admin", ['name' => 'Laura', 'email' => 'laura.nueva@example.com'])->assertOk();

        $this->assertSame(0, $admin->tokens()->count());
        $this->assertSame('laura.nueva@example.com', $clientInvite->fresh()->email);
    }

    public function test_setting_the_password_invalidates_pending_reset_links(): void
    {
        [$bank, $admin] = $this->activeBank();
        $resetToken = Password::broker()->createToken($admin);
        Sanctum::actingAs($this->superadmin);

        $this->putJson("/api/platform/banks/{$bank->id}/admin/password", ['password' => 'clave-nueva-1', 'password_confirmation' => 'clave-nueva-1'])->assertOk();

        $this->postJson('/api/auth/reset-password', [
            'token' => $resetToken, 'email' => $admin->email, 'password' => 'otra-clave-99', 'password_confirmation' => 'otra-clave-99',
        ])->assertJsonValidationErrors('token');
        $this->assertTrue(Hash::check('clave-nueva-1', $admin->fresh()->password));
    }

    public function test_recording_activity_does_not_touch_updated_at(): void
    {
        $user = User::factory()->create();
        $updatedAt = $user->updated_at;
        $this->travel(10)->minutes();

        $this->withToken($user->createToken('web')->plainTextToken)->getJson('/api/auth/me')->assertOk();

        $this->assertNotNull($user->fresh()->last_seen_at);
        $this->assertEquals($updatedAt, $user->fresh()->updated_at);
    }
}
