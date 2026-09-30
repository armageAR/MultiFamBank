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
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PlatformBanksTest extends TestCase
{
    use RefreshDatabase;

    private User $superadmin;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        $this->superadmin = User::factory()->superadmin()->create();
    }

    public function test_only_the_superadmin_can_use_the_platform_endpoints(): void
    {
        $this->getJson('/api/platform/banks')->assertUnauthorized();

        Sanctum::actingAs(User::factory()->create());
        $this->getJson('/api/platform/banks')->assertForbidden();
        $this->postJson('/api/platform/banks', ['admin_email' => 'a@example.com', 'admin_name' => 'A'])->assertForbidden();
    }

    public function test_creating_a_bank_invites_its_administrator(): void
    {
        Sanctum::actingAs($this->superadmin);

        $response = $this->postJson('/api/platform/banks', ['admin_email' => ' Laura@Example.com ', 'admin_name' => 'Laura Pérez']);

        $response->assertCreated()
            ->assertJsonPath('data.status', 'pending_configuration')
            ->assertJsonPath('data.admin.email', 'laura@example.com')
            ->assertJsonPath('data.admin.name', 'Laura Pérez')
            ->assertJsonPath('data.admin.accepted', false)
            ->assertJsonPath('data.invitation.state', 'pending')
            ->assertJsonPath('email_sent', true);

        $bank = Bank::sole();
        $this->assertSame(BankStatus::PendingConfiguration, $bank->status);
        $this->assertSame($this->superadmin->id, $bank->created_by);

        $invitation = Invitation::sole();
        $this->assertSame(InvitationType::BankAdmin, $invitation->type);
        $this->assertSame(1, $invitation->send_count);
        $this->assertNotNull($invitation->last_sent_at);

        Mail::assertSent(BankAdminInvitationMail::class, function (BankAdminInvitationMail $mail) use ($invitation) {
            $token = basename($mail->acceptUrl);

            return $mail->hasTo('laura@example.com')
                && str_starts_with($mail->acceptUrl, config('multifambank.urls.admin').'/invitacion/')
                && Invitation::hashToken($token) === $invitation->token_hash;
        });

        $this->assertDatabaseHas('audit_logs', ['action' => 'bank.created', 'bank_id' => $bank->id, 'actor_user_id' => $this->superadmin->id]);
    }

    public function test_the_invitation_link_is_returned_only_while_email_delivery_is_not_configured(): void
    {
        Sanctum::actingAs($this->superadmin);

        config(['multifambank.expose_invitation_links' => true]);
        $url = $this->postJson('/api/platform/banks', ['admin_email' => 'a@example.com', 'admin_name' => 'A'])->json('invitation_url');
        $this->assertStringStartsWith(config('multifambank.urls.admin').'/invitacion/', $url);

        config(['multifambank.expose_invitation_links' => false]);
        $this->postJson('/api/platform/banks', ['admin_email' => 'b@example.com', 'admin_name' => 'B'])->assertJsonPath('invitation_url', null);
    }

    public function test_an_email_already_assigned_to_a_bank_is_rejected_without_side_effects(): void
    {
        Sanctum::actingAs($this->superadmin);
        $this->postJson('/api/platform/banks', ['admin_email' => 'laura@example.com', 'admin_name' => 'Laura'])->assertCreated();

        $this->postJson('/api/platform/banks', ['admin_email' => 'LAURA@example.com', 'admin_name' => 'Otra'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('admin_email');

        $this->assertSame(1, Bank::count());
        $this->assertSame(1, Invitation::count());
        $this->assertSame(1, AuditLog::where('action', 'bank.created')->count());
        Mail::assertSentCount(1);
    }

    public function test_an_accepted_administrator_cannot_be_assigned_a_second_bank(): void
    {
        $admin = User::factory()->create(['email' => 'new-address@example.com']);
        // The admin accepted with a different original email, so only admin_user_id links them.
        Bank::create(['admin_email' => 'old-address@example.com', 'admin_user_id' => $admin->id, 'status' => BankStatus::Active]);
        Sanctum::actingAs($this->superadmin);

        $this->postJson('/api/platform/banks', ['admin_email' => 'new-address@example.com', 'admin_name' => 'X'])
            ->assertJsonValidationErrors('admin_email');
    }

    public function test_an_existing_client_can_be_invited_as_administrator(): void
    {
        User::factory()->create(['email' => 'client@example.com']);
        Sanctum::actingAs($this->superadmin);

        $this->postJson('/api/platform/banks', ['admin_email' => 'client@example.com', 'admin_name' => 'Cliente'])->assertCreated();
    }

    public function test_the_bank_list_shows_status_admin_and_counts(): void
    {
        Sanctum::actingAs($this->superadmin);
        $this->postJson('/api/platform/banks', ['admin_email' => 'pending@example.com', 'admin_name' => 'Pendiente'])->assertCreated();
        $admin = User::factory()->create(['name' => 'Marta', 'email' => 'marta@example.com']);
        Bank::create(['name' => 'Familia Gómez', 'admin_email' => 'marta@example.com', 'admin_user_id' => $admin->id, 'status' => BankStatus::Active]);

        $response = $this->getJson('/api/platform/banks');

        $response->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.name', 'Familia Gómez')
            ->assertJsonPath('data.0.admin.name', 'Marta')
            ->assertJsonPath('data.0.admin.accepted', true)
            ->assertJsonPath('data.1.name', null)
            ->assertJsonPath('data.1.admin.name', 'Pendiente')
            ->assertJsonPath('counts.active', 1)
            ->assertJsonPath('counts.pending_configuration', 1)
            ->assertJsonPath('counts.paused', 0)
            ->assertJsonPath('meta.total', 2);

        $this->getJson('/api/platform/banks?status=active')->assertJsonCount(1, 'data');
        $this->getJson('/api/platform/banks?search=gómez')->assertJsonCount(1, 'data');
        $this->getJson('/api/platform/banks?search=pending@')->assertJsonCount(1, 'data');
        $this->getJson('/api/platform/banks?status=nope')->assertUnprocessable();
    }

    public function test_validation_errors(): void
    {
        Sanctum::actingAs($this->superadmin);

        $this->postJson('/api/platform/banks', ['admin_email' => 'not-an-email', 'admin_name' => ''])
            ->assertJsonValidationErrors(['admin_email', 'admin_name']);
    }
}
