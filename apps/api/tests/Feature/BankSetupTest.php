<?php

namespace Tests\Feature;

use App\Enums\BankStatus;
use App\Models\Bank;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BankSetupTest extends TestCase
{
    use RefreshDatabase;

    public function test_completing_the_setup_activates_the_bank(): void
    {
        $admin = User::factory()->create();
        $bank = Bank::create(['admin_email' => $admin->email, 'admin_user_id' => $admin->id, 'status' => BankStatus::PendingConfiguration]);
        Sanctum::actingAs($admin);

        $this->putJson('/api/admin/bank', ['name' => 'Familia Pérez', 'timezone' => 'America/Argentina/Cordoba'])
            ->assertOk()
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.name', 'Familia Pérez');

        $bank->refresh();
        $this->assertSame(BankStatus::Active, $bank->status);
        $this->assertNotNull($bank->activated_at);
        $this->assertDatabaseHas('audit_logs', ['action' => 'bank.configured', 'bank_id' => $bank->id, 'actor_user_id' => $admin->id]);
    }

    public function test_editing_a_paused_bank_keeps_it_paused(): void
    {
        $admin = User::factory()->create();
        Bank::create(['name' => 'X', 'admin_email' => $admin->email, 'admin_user_id' => $admin->id, 'status' => BankStatus::Paused]);
        Sanctum::actingAs($admin);

        $this->putJson('/api/admin/bank', ['name' => 'Y', 'timezone' => 'UTC'])->assertJsonPath('data.status', 'paused');
    }

    public function test_only_the_bank_administrator_can_configure_it(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/admin/bank')->assertForbidden();
        $this->putJson('/api/admin/bank', ['name' => 'X', 'timezone' => 'UTC'])->assertForbidden();
    }

    public function test_validation(): void
    {
        $admin = User::factory()->create();
        Bank::create(['admin_email' => $admin->email, 'admin_user_id' => $admin->id]);
        Sanctum::actingAs($admin);

        $this->putJson('/api/admin/bank', ['name' => '', 'timezone' => 'Mars/Olympus'])
            ->assertJsonValidationErrors(['name', 'timezone']);
    }
}
