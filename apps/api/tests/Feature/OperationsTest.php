<?php

namespace Tests\Feature;

use App\Enums\BankStatus;
use App\Models\Bank;
use App\Models\BankMembership;
use App\Models\LedgerEntry;
use App\Models\MoneyRequest;
use App\Models\SavingsAccount;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Factory;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OperationsTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $client;

    private Bank $bank;

    private BankMembership $membership;

    protected function setUp(): void
    {
        parent::setUp();
        // Blue: buy 1000, sell 1100.
        Http::fake(['api.bluelytics.com.ar/*' => Http::response([
            'blue' => ['value_buy' => 1000, 'value_sell' => 1100],
            'oficial' => ['value_buy' => 900, 'value_sell' => 950],
            'last_update' => now()->toIso8601String(),
        ])]);

        $this->admin = User::factory()->create(['name' => 'Admin']);
        $this->client = User::factory()->create(['name' => 'Sofía']);
        $this->bank = Bank::create(['name' => 'Familia', 'admin_email' => $this->admin->email, 'admin_user_id' => $this->admin->id, 'status' => BankStatus::Active, 'activated_at' => now()]);
        $this->membership = $this->bank->memberships()->create(['user_id' => $this->client->id]);
        $this->membership->savingsAccount()->create(['bank_id' => $this->bank->id, 'balance_usd' => '100.00']);
    }

    private function account(): SavingsAccount
    {
        return $this->membership->savingsAccount()->first();
    }

    private function ask(array $data)
    {
        Sanctum::actingAs($this->client);

        return $this->postJson("/api/client/banks/{$this->bank->id}/operations", $data);
    }

    private function asAdmin(): void
    {
        Sanctum::actingAs($this->admin);
    }

    public function test_a_withdrawal_request_reserves_dollars_at_the_blue_buy_rate(): void
    {
        $response = $this->ask(['type' => 'savings_withdrawal', 'amount_ars' => '20000']);

        $response->assertCreated()
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.exchange_rate', '1000.0000')
            ->assertJsonPath('data.amount_usd', '20.00')
            ->assertJsonPath('data.funding_source', 'client_savings');
        $this->assertSame('20.00', (string) $this->account()->reserved_usd);
        $this->assertSame('80.00', $this->account()->availableUsd());
    }

    public function test_a_deposit_uses_the_blue_sell_rate_and_reserves_nothing(): void
    {
        $this->ask(['type' => 'savings_deposit', 'amount_ars' => '11000'])->assertCreated()->assertJsonPath('data.amount_usd', '10.00');
        $this->assertSame('0.00', (string) $this->account()->reserved_usd);
    }

    public function test_an_expense_needs_a_comment_and_does_not_touch_savings(): void
    {
        $this->ask(['type' => 'expense', 'amount_ars' => '15000'])->assertJsonValidationErrors('description');
        $this->ask(['type' => 'expense', 'amount_ars' => '15000', 'description' => '   '])->assertJsonValidationErrors('description');

        $this->ask(['type' => 'expense', 'amount_ars' => '15000', 'description' => 'Salida con amigos'])
            ->assertCreated()->assertJsonPath('data.funding_source', 'bank_funds')->assertJsonPath('data.amount_usd', null);
        $this->assertSame('0.00', (string) $this->account()->reserved_usd);
    }

    public function test_a_withdrawal_above_the_available_balance_is_rejected(): void
    {
        $this->ask(['type' => 'savings_withdrawal', 'amount_ars' => '90000'])->assertCreated();
        $this->ask(['type' => 'savings_withdrawal', 'amount_ars' => '20000'])->assertJsonValidationErrors('amount_ars');
        $this->assertSame('90.00', (string) $this->account()->reserved_usd);
    }

    public function test_retrying_with_the_same_id_does_not_duplicate_the_request(): void
    {
        $id = (string) Str::uuid();
        $this->ask(['id' => $id, 'type' => 'savings_withdrawal', 'amount_ars' => '20000'])->assertCreated();
        $this->ask(['id' => $id, 'type' => 'savings_withdrawal', 'amount_ars' => '20000'])->assertOk();

        $this->assertSame(1, MoneyRequest::count());
        $this->assertSame('20.00', (string) $this->account()->reserved_usd);
    }

    public function test_confirming_a_withdrawal_with_a_new_rate_settles_the_reservation_once(): void
    {
        $id = $this->ask(['type' => 'savings_withdrawal', 'amount_ars' => '20000'])->json('data.id');
        $this->asAdmin();

        $this->postJson("/api/admin/operations/$id/confirm", ['exchange_rate' => '800'])
            ->assertOk()->assertJsonPath('data.status', 'confirmed')->assertJsonPath('data.amount_usd', '25.00');

        $account = $this->account();
        $this->assertSame('75.00', (string) $account->balance_usd);
        $this->assertSame('0.00', (string) $account->reserved_usd);
        $this->assertSame(1, LedgerEntry::where('money_request_id', $id)->count());
        $this->assertNotNull(MoneyRequest::find($id)->occurred_at);

        $this->postJson("/api/admin/operations/$id/confirm")->assertJsonValidationErrors('request');
        $this->assertSame('75.00', (string) $this->account()->balance_usd);
    }

    public function test_confirming_a_deposit_credits_savings(): void
    {
        $id = $this->ask(['type' => 'savings_deposit', 'amount_ars' => '11000'])->json('data.id');
        $this->asAdmin();
        $this->postJson("/api/admin/operations/$id/confirm")->assertOk();

        $this->assertSame('110.00', (string) $this->account()->balance_usd);
    }

    public function test_the_admin_can_change_everything_on_a_pending_request(): void
    {
        $id = $this->ask(['type' => 'expense', 'amount_ars' => '15000', 'description' => 'Salida'])->json('data.id');
        $this->asAdmin();

        // Expense turned into a savings withdrawal paid by the client, with another amount, comment and date.
        $this->patchJson("/api/admin/operations/$id", [
            'type' => 'savings_withdrawal',
            'amount_ars' => '10000',
            'description' => 'Salida, la paga con sus ahorros',
            'exchange_rate' => '1000',
            'occurred_at' => '2026-09-15T12:00:00Z',
        ])->assertOk()
            ->assertJsonPath('data.type', 'savings_withdrawal')
            ->assertJsonPath('data.amount_usd', '10.00')
            ->assertJsonPath('data.requested.type', 'expense')
            ->assertJsonPath('data.requested.amount_ars', '15000.00')
            ->assertJsonPath('data.changed_by_admin', true);
        $this->assertSame('10.00', (string) $this->account()->reserved_usd);

        // Back to an expense releases the reservation; an expense still needs a comment.
        $this->patchJson("/api/admin/operations/$id", ['type' => 'expense', 'description' => ''])->assertJsonValidationErrors('description');
        $this->patchJson("/api/admin/operations/$id", ['type' => 'expense'])->assertOk();
        $this->assertSame('0.00', (string) $this->account()->reserved_usd);

        $this->postJson("/api/admin/operations/$id/confirm")->assertOk();
        $entry = LedgerEntry::where('money_request_id', $id)->sole();
        $this->assertSame('bank_expense', $entry->kind->value);
        $this->assertSame('2026-09-15', $entry->occurred_at->toDateString());
        $this->assertSame('100.00', (string) $this->account()->balance_usd);
        $this->assertDatabaseHas('audit_logs', ['action' => 'request.updated', 'subject_id' => $id]);
    }

    public function test_turning_a_request_into_a_withdrawal_checks_the_available_balance(): void
    {
        $id = $this->ask(['type' => 'expense', 'amount_ars' => '500000', 'description' => 'Vacaciones'])->json('data.id');
        $this->asAdmin();

        $this->patchJson("/api/admin/operations/$id", ['type' => 'savings_withdrawal', 'exchange_rate' => '1000'])
            ->assertJsonValidationErrors('amount_ars');
        $this->assertSame('expense', MoneyRequest::find($id)->type->value);
    }

    public function test_rejecting_or_canceling_releases_the_reservation(): void
    {
        $first = $this->ask(['type' => 'savings_withdrawal', 'amount_ars' => '20000'])->json('data.id');
        $second = $this->ask(['type' => 'savings_withdrawal', 'amount_ars' => '30000'])->json('data.id');
        $this->assertSame('50.00', (string) $this->account()->reserved_usd);

        $this->postJson("/api/client/banks/{$this->bank->id}/operations/$second/cancel")->assertOk()->assertJsonPath('data.status', 'canceled');
        $this->asAdmin();
        $this->postJson("/api/admin/operations/$first/reject", ['reason' => 'No corresponde'])->assertOk()->assertJsonPath('data.rejection_reason', 'No corresponde');

        $this->assertSame('0.00', (string) $this->account()->reserved_usd);
        $this->assertSame('100.00', (string) $this->account()->balance_usd);
    }

    public function test_the_admin_records_operations_that_are_confirmed_at_once(): void
    {
        $this->asAdmin();

        $this->postJson("/api/admin/clients/{$this->membership->id}/operations", ['type' => 'savings_deposit', 'amount_ars' => '50000', 'exchange_rate' => '1000', 'occurred_at' => '2026-09-01T10:00:00Z'])
            ->assertCreated()->assertJsonPath('data.status', 'confirmed')->assertJsonPath('data.recorded_by_admin', true);
        $this->postJson("/api/admin/clients/{$this->membership->id}/operations", ['type' => 'savings_deposit', 'amount_ars' => '50000'])
            ->assertJsonValidationErrors('exchange_rate');
        $this->postJson("/api/admin/clients/{$this->membership->id}/operations", ['type' => 'savings_withdrawal', 'amount_ars' => '1000000', 'exchange_rate' => '1000'])
            ->assertJsonValidationErrors('amount_ars');

        $this->assertSame('150.00', (string) $this->account()->balance_usd);
    }

    public function test_the_date_of_a_confirmed_operation_can_be_changed_without_touching_balances(): void
    {
        $this->asAdmin();
        $id = $this->postJson("/api/admin/clients/{$this->membership->id}/operations", ['type' => 'expense', 'amount_ars' => '8000', 'description' => 'Útiles'])->json('data.id');

        $this->putJson("/api/admin/operations/$id/date", ['occurred_at' => '2026-08-20T15:00:00Z'])->assertOk();

        $this->assertSame('2026-08-20', MoneyRequest::find($id)->occurred_at->toDateString());
        $this->assertSame('2026-08-20', LedgerEntry::where('money_request_id', $id)->sole()->occurred_at->toDateString());
        $this->assertSame('100.00', (string) $this->account()->balance_usd);
        $this->assertDatabaseHas('audit_logs', ['action' => 'request.date_changed', 'subject_id' => $id]);

        $pending = $this->ask(['type' => 'savings_deposit', 'amount_ars' => '1100'])->json('data.id');
        $this->asAdmin();
        $this->putJson("/api/admin/operations/$pending/date", ['occurred_at' => '2026-08-20T15:00:00Z'])->assertJsonValidationErrors('occurred_at');
    }

    public function test_a_paused_bank_is_read_only(): void
    {
        $id = $this->ask(['type' => 'savings_withdrawal', 'amount_ars' => '20000'])->json('data.id');
        $this->bank->update(['status' => BankStatus::Paused]);

        $this->ask(['type' => 'savings_deposit', 'amount_ars' => '1000'])->assertJsonValidationErrors('bank');
        $this->getJson("/api/client/banks/{$this->bank->id}/operations")->assertOk()->assertJsonCount(1, 'data');
        $this->asAdmin();
        $this->postJson("/api/admin/operations/$id/confirm")->assertJsonValidationErrors('bank');
        $this->getJson('/api/admin/operations/pending')->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_tenants_are_isolated(): void
    {
        $id = $this->ask(['type' => 'savings_withdrawal', 'amount_ars' => '20000'])->json('data.id');
        $otherAdmin = User::factory()->create();
        Bank::create(['name' => 'Otra', 'admin_email' => $otherAdmin->email, 'admin_user_id' => $otherAdmin->id, 'status' => BankStatus::Active]);
        Sanctum::actingAs($otherAdmin);

        $this->postJson("/api/admin/operations/$id/confirm")->assertNotFound();
        $this->getJson("/api/admin/clients/{$this->membership->id}/operations")->assertNotFound();
        $this->getJson("/api/client/banks/{$this->bank->id}/operations")->assertNotFound();
    }

    public function test_the_rate_service_being_down_blocks_savings_requests_only(): void
    {
        // Replace the successful stub from setUp with a failing one.
        Http::swap(new Factory);
        Http::fake(['api.bluelytics.com.ar/*' => Http::response(null, 500)]);
        cache()->flush();

        $this->ask(['type' => 'savings_deposit', 'amount_ars' => '1000'])->assertJsonValidationErrors('exchange_rate');
        $this->ask(['type' => 'expense', 'amount_ars' => '1000', 'description' => 'Colectivo'])->assertCreated();
    }

    public function test_turning_a_deposit_into_a_withdrawal_requotes_at_the_buy_rate(): void
    {
        $id = $this->ask(['type' => 'savings_deposit', 'amount_ars' => '11000'])->json('data.id');
        $this->asAdmin();

        // Deposit was quoted at the sell rate (1100); as a withdrawal it must use buy (1000).
        $this->patchJson("/api/admin/operations/$id", ['type' => 'savings_withdrawal'])
            ->assertOk()->assertJsonPath('data.exchange_rate', '1000.0000')->assertJsonPath('data.amount_usd', '11.00');
        $this->assertSame('11.00', (string) $this->account()->reserved_usd);
    }

    public function test_reusing_an_id_for_a_different_request_is_refused(): void
    {
        $id = (string) Str::uuid();
        $this->ask(['id' => $id, 'type' => 'savings_withdrawal', 'amount_ars' => '20000'])->assertCreated();

        $this->ask(['id' => $id, 'type' => 'savings_withdrawal', 'amount_ars' => '30000'])->assertJsonValidationErrors('id');
    }

    public function test_dates_must_carry_a_time_zone_and_rates_must_be_realistic(): void
    {
        $this->asAdmin();
        $url = "/api/admin/clients/{$this->membership->id}/operations";

        $this->postJson($url, ['type' => 'expense', 'amount_ars' => '100', 'description' => 'x', 'occurred_at' => '2026-09-01'])->assertJsonValidationErrors('occurred_at');
        $this->postJson($url, ['type' => 'expense', 'amount_ars' => '100', 'description' => 'x', 'occurred_at' => '1999-12-31T10:00:00Z'])->assertJsonValidationErrors('occurred_at');
        $this->postJson($url, ['type' => 'savings_deposit', 'amount_ars' => '100000', 'exchange_rate' => '0.5'])->assertJsonValidationErrors('exchange_rate');
        $this->postJson($url, ['type' => 'savings_deposit', 'amount_ars' => '0.01', 'exchange_rate' => '1000'])->assertJsonValidationErrors('amount_ars');
        $this->postJson($url, ['type' => 'expense', 'amount_ars' => '100', 'description' => 'x', 'occurred_at' => '2026-09-01T10:00:00-03:00'])->assertCreated();
    }

    public function test_the_last_good_quote_is_used_when_the_rate_service_fails(): void
    {
        $this->ask(['type' => 'savings_deposit', 'amount_ars' => '1100'])->assertCreated();
        Http::swap(new Factory);
        Http::fake(['api.bluelytics.com.ar/*' => Http::response(null, 500)]);
        cache()->forget('exchange_rates.latest');

        $this->ask(['type' => 'savings_deposit', 'amount_ars' => '1100'])->assertCreated()->assertJsonPath('data.exchange_rate', '1100.0000');

        // A fallback older than a day is not used.
        $this->travel(25)->hours();
        cache()->forget('exchange_rates.latest');
        cache()->forget('exchange_rates.failing');
        $this->ask(['type' => 'savings_deposit', 'amount_ars' => '1100'])->assertJsonValidationErrors('exchange_rate');
    }
}
