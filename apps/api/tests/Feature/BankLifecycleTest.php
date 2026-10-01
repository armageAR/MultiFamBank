<?php

namespace Tests\Feature;

use App\Enums\BankStatus;
use App\Enums\InvitationType;
use App\Models\Bank;
use App\Models\Invitation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BankLifecycleTest extends TestCase
{
    use RefreshDatabase;

    private User $superadmin;

    private User $admin;

    private Bank $bank;

    protected function setUp(): void
    {
        parent::setUp();
        $this->superadmin = User::factory()->superadmin()->create();
        $this->admin = User::factory()->create(['email' => 'laura@example.com']);
        $this->bank = Bank::create([
            'name' => 'Familia',
            'admin_email' => 'laura@example.com',
            'admin_user_id' => $this->admin->id,
            'status' => BankStatus::Active,
            'activated_at' => now(),
        ]);
    }

    private function act(string $action, ?Bank $bank = null)
    {
        Sanctum::actingAs($this->superadmin);

        return $this->postJson('/api/platform/banks/'.($bank ?? $this->bank)->id.'/status', ['action' => $action]);
    }

    public function test_pause_and_resume(): void
    {
        $this->act('pause')->assertOk()->assertJsonPath('data.status', 'paused');
        $this->assertNotNull($this->bank->fresh()->paused_at);

        $this->act('pause')->assertJsonValidationErrors('status');

        $this->act('resume')->assertOk()->assertJsonPath('data.status', 'active');
        $this->assertNull($this->bank->fresh()->paused_at);
        $this->assertDatabaseHas('audit_logs', ['action' => 'bank.paused', 'bank_id' => $this->bank->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'bank.resumed', 'bank_id' => $this->bank->id]);
    }

    public function test_a_paused_bank_stays_visible_to_its_administrator(): void
    {
        $this->act('pause');

        Sanctum::actingAs($this->admin);
        $this->getJson('/api/auth/me')->assertJsonPath('data.administered_bank.status', 'paused');
        $this->getJson('/api/admin/bank')->assertOk();
    }

    public function test_a_deactivated_bank_disappears_for_its_administrator(): void
    {
        $this->act('deactivate')->assertOk()->assertJsonPath('data.status', 'deactivated');

        Sanctum::actingAs($this->admin);
        $this->getJson('/api/auth/me')->assertOk()->assertJsonPath('data.administered_bank', null);
        $this->getJson('/api/admin/bank')->assertForbidden();
    }

    public function test_reactivation_restores_access_and_keeps_the_email_reserved(): void
    {
        $this->act('pause');
        $this->act('deactivate')->assertOk();

        // Deactivation does not release the administrator's email.
        $this->postJson('/api/platform/banks', ['admin_email' => 'laura@example.com', 'admin_name' => 'Otra'])
            ->assertJsonValidationErrors('admin_email');

        $this->act('reactivate')->assertOk()->assertJsonPath('data.status', 'active');
        $bank = $this->bank->fresh();
        $this->assertNull($bank->deactivated_at);
        $this->assertNull($bank->paused_at);

        Sanctum::actingAs($this->admin);
        $this->getJson('/api/admin/bank')->assertOk();
    }

    public function test_a_never_configured_bank_reactivates_as_pending_configuration(): void
    {
        $pending = Bank::create(['admin_email' => 'nuevo@example.com', 'status' => BankStatus::PendingConfiguration]);

        $this->act('pause', $pending)->assertJsonValidationErrors('status');
        $this->act('deactivate', $pending)->assertOk();
        $this->act('reactivate', $pending)->assertOk()->assertJsonPath('data.status', 'pending_configuration');
    }

    public function test_invitations_to_a_deactivated_bank_do_not_exist(): void
    {
        $token = Invitation::newToken();
        $this->bank->invitations()->create([
            'type' => InvitationType::BankClient,
            'email' => 'nico@example.com',
            'name' => 'Nico',
            'token_hash' => Invitation::hashToken($token),
            'expires_at' => now()->addDay(),
        ]);
        $this->act('deactivate');

        $this->getJson("/api/invitations/$token")->assertNotFound();
        $this->postJson("/api/invitations/$token/accept", ['name' => 'Nico', 'password' => 'clave-segura', 'password_confirmation' => 'clave-segura'])
            ->assertNotFound();
        $this->assertNull(User::where('email', 'nico@example.com')->first());
    }

    public function test_invalid_transitions_and_authorization(): void
    {
        $this->act('resume')->assertJsonValidationErrors('status');
        $this->act('reactivate')->assertJsonValidationErrors('status');
        $this->act('explode')->assertJsonValidationErrors('action');

        Sanctum::actingAs($this->admin);
        $this->postJson("/api/platform/banks/{$this->bank->id}/status", ['action' => 'pause'])->assertForbidden();
        $this->assertSame(BankStatus::Active, $this->bank->fresh()->status);
    }
}
