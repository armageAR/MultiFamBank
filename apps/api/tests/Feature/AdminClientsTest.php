<?php

namespace Tests\Feature;

use App\Enums\BankStatus;
use App\Enums\MembershipStatus;
use App\Mail\ClientInvitationMail;
use App\Models\Bank;
use App\Models\BankMembership;
use App\Models\Invitation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminClientsTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private Bank $bank;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        Http::fake(['api.bluelytics.com.ar/*' => Http::response([
            'blue' => ['value_buy' => 1000, 'value_sell' => 1100], 'oficial' => ['value_buy' => 900, 'value_sell' => 950], 'last_update' => now()->toIso8601String(),
        ])]);
        $this->admin = User::factory()->create(['email' => 'admin@example.com']);
        $this->bank = Bank::create(['name' => 'Familia', 'admin_email' => 'admin@example.com', 'admin_user_id' => $this->admin->id, 'status' => BankStatus::Active, 'activated_at' => now()]);
        Sanctum::actingAs($this->admin);
    }

    private function client(string $email = 'sofia@example.com', string $balance = '0.00'): BankMembership
    {
        $user = User::factory()->create(['email' => $email, 'name' => ucfirst(strtok($email, '@'))]);
        $membership = $this->bank->memberships()->create(['user_id' => $user->id]);
        $membership->savingsAccount()->create(['bank_id' => $this->bank->id, 'balance_usd' => $balance]);

        return $membership;
    }

    public function test_inviting_a_client_sends_a_link_to_the_client_app(): void
    {
        config(['multifambank.expose_invitation_links' => true]);

        $response = $this->postJson('/api/admin/clients/invitations', ['email' => 'Nico@Example.com', 'name' => 'Nico']);

        $response->assertCreated()->assertJsonPath('data.email', 'nico@example.com')->assertJsonPath('data.state', 'pending');
        $this->assertStringStartsWith(config('multifambank.urls.client').'/invitacion/', $response->json('invitation_url'));
        Mail::assertSent(ClientInvitationMail::class, fn ($mail) => $mail->hasTo('nico@example.com'));
        $this->getJson('/api/admin/clients')->assertJsonCount(1, 'data.invitations');
    }

    public function test_reinviting_replaces_the_previous_link_and_accepting_creates_the_client(): void
    {
        config(['multifambank.expose_invitation_links' => true]);
        $first = $this->postJson('/api/admin/clients/invitations', ['email' => 'nico@example.com', 'name' => 'Nico'])->json('invitation_url');
        $second = $this->postJson('/api/admin/clients/invitations', ['email' => 'nico@example.com', 'name' => 'Nico'])->json('invitation_url');

        $this->getJson('/api/invitations/'.basename($first))->assertJsonPath('state', 'revoked');
        $this->postJson('/api/invitations/'.basename($second).'/accept', ['name' => 'Nico', 'password' => 'clave-segura-1', 'password_confirmation' => 'clave-segura-1'])->assertOk();

        $clients = $this->getJson('/api/admin/clients')->json('data');
        $this->assertCount(1, $clients['clients']);
        $this->assertSame('Nico', $clients['clients'][0]['name']);
        $this->assertCount(0, $clients['invitations']);
    }

    public function test_invitation_rules(): void
    {
        $this->client('sofia@example.com');

        $this->postJson('/api/admin/clients/invitations', ['email' => 'sofia@example.com', 'name' => 'Sofía'])->assertJsonValidationErrors('email');
        $this->postJson('/api/admin/clients/invitations', ['email' => 'admin@example.com', 'name' => 'Yo'])->assertJsonValidationErrors('email');

        $this->bank->update(['status' => BankStatus::Paused]);
        $this->postJson('/api/admin/clients/invitations', ['email' => 'otro@example.com', 'name' => 'Otro'])->assertJsonValidationErrors('bank');
    }

    public function test_the_list_shows_balances_and_whether_the_admin_may_edit_the_person(): void
    {
        $sofia = $this->client('sofia@example.com', '120.50');
        $shared = $this->client('tomas@example.com');
        $other = Bank::create(['name' => 'Otra', 'admin_email' => 'x@example.com', 'status' => BankStatus::Active]);
        $other->memberships()->create(['user_id' => $shared->user_id]);

        $clients = collect($this->getJson('/api/admin/clients')->assertOk()->json('data.clients'))->keyBy('email');

        $this->assertSame('120.50', $clients['sofia@example.com']['balance_usd']);
        $this->assertTrue($clients['sofia@example.com']['manageable']);
        $this->assertFalse($clients['tomas@example.com']['manageable']);

        $this->patchJson("/api/admin/clients/{$shared->id}", ['name' => 'X', 'email' => 'x2@example.com'])->assertJsonValidationErrors('client');
        $this->patchJson("/api/admin/clients/{$sofia->id}", ['name' => 'Sofía P.', 'email' => 'sofia.p@example.com'])->assertOk()->assertJsonPath('data.email', 'sofia.p@example.com');
    }

    public function test_the_admin_can_set_a_password_or_send_a_reset_link(): void
    {
        $sofia = $this->client();
        $sofia->user->createToken('session');

        $this->putJson("/api/admin/clients/{$sofia->id}/password", ['password' => 'nueva-clave-1', 'password_confirmation' => 'nueva-clave-1'])->assertOk();
        $this->assertTrue(Hash::check('nueva-clave-1', $sofia->user->fresh()->password));
        $this->assertSame(0, $sofia->user->tokens()->count());

        $this->postJson("/api/admin/clients/{$sofia->id}/password-reset")->assertOk();
    }

    public function test_deactivating_a_client_keeps_their_balance_and_blocks_their_access(): void
    {
        $sofia = $this->client('sofia@example.com', '50.00');

        Sanctum::actingAs($sofia->user);
        $id = $this->postJson("/api/client/banks/{$this->bank->id}/operations", ['type' => 'savings_withdrawal', 'amount_ars' => '1000'])->json('data.id');
        Sanctum::actingAs($this->admin);
        $this->postJson("/api/admin/clients/{$sofia->id}/deactivate")->assertJsonValidationErrors('membership');

        $this->postJson("/api/admin/operations/$id/reject")->assertOk();
        $this->postJson("/api/admin/clients/{$sofia->id}/deactivate")->assertOk()->assertJsonPath('data.status', 'removed')->assertJsonPath('data.balance_usd', '50.00');

        Sanctum::actingAs($sofia->user);
        $this->getJson('/api/client/banks')->assertJsonCount(0, 'data');
        $this->getJson("/api/client/banks/{$this->bank->id}")->assertNotFound();

        Sanctum::actingAs($this->admin);
        $this->postJson("/api/admin/clients/{$sofia->id}/reactivate")->assertOk()->assertJsonPath('data.status', 'active');
        $this->assertSame(MembershipStatus::Active, $sofia->fresh()->status);
    }

    public function test_other_banks_clients_and_invitations_are_out_of_reach(): void
    {
        $other = Bank::create(['name' => 'Otra', 'admin_email' => 'x@example.com', 'status' => BankStatus::Active]);
        $foreign = $other->memberships()->create(['user_id' => User::factory()->create()->id]);
        $invitation = $other->invitations()->create([
            'type' => 'bank_client', 'email' => 'z@example.com', 'name' => 'Z', 'token_hash' => Invitation::hashToken('t'), 'expires_at' => now()->addDay(),
        ]);

        $this->patchJson("/api/admin/clients/{$foreign->id}", ['name' => 'X', 'email' => 'x3@example.com'])->assertNotFound();
        $this->postJson("/api/admin/clients/invitations/{$invitation->id}/resend")->assertNotFound();
        $this->deleteJson("/api/admin/clients/invitations/{$invitation->id}")->assertNotFound();
    }

    public function test_dashboard_and_monthly_expense_report(): void
    {
        $sofia = $this->client('sofia@example.com', '100.00');
        $tomas = $this->client('tomas@example.com', '20.00');
        $record = fn ($m, $data) => $this->postJson("/api/admin/clients/{$m->id}/operations", $data)->assertCreated();
        $record($sofia, ['type' => 'expense', 'amount_ars' => '15000', 'description' => 'Salida', 'occurred_at' => '2026-09-10T15:00:00Z']);
        $record($tomas, ['type' => 'expense', 'amount_ars' => '5000', 'description' => 'Útiles', 'occurred_at' => '2026-09-12T15:00:00Z']);
        $record($sofia, ['type' => 'expense', 'amount_ars' => '7000', 'description' => 'Agosto', 'occurred_at' => '2026-08-31T23:30:00-03:00']);
        $record($sofia, ['type' => 'savings_withdrawal', 'amount_ars' => '10000', 'exchange_rate' => '1000', 'occurred_at' => '2026-09-11T15:00:00Z']);

        $report = $this->getJson('/api/admin/reports/expenses?month=2026-09')->assertOk()->json('data');
        $this->assertSame('20000.00', $report['total_ars']);
        $this->assertSame('Sofia', $report['by_client'][0]['name']);
        $this->assertSame('15000.00', $report['by_client'][0]['total_ars']);
        $this->assertSame('10000.00', $report['savings']['withdrawals_ars']);
        // 23:30 in Buenos Aires on Aug 31 is still August there, though September in UTC.
        $this->assertSame('7000.00', $this->getJson('/api/admin/reports/expenses?month=2026-08')->json('data.total_ars'));

        $dashboard = $this->getJson('/api/admin/dashboard')->assertOk()->json('data');
        $this->assertSame('110.00', $dashboard['balance_usd']);
        $this->assertSame(2, $dashboard['clients']);
        $this->assertSame('1000.00', $dashboard['exchange_rates']['blue']['buy']);
    }
}
