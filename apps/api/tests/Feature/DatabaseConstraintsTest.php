<?php

namespace Tests\Feature;

use App\Enums\BankStatus;
use App\Models\Bank;
use App\Models\BankMembership;
use App\Models\MoneyRequest;
use App\Models\SavingsAccount;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/** Invariants the database enforces on its own (CHECK constraints exist only on PostgreSQL). */
class DatabaseConstraintsTest extends TestCase
{
    use RefreshDatabase;

    private BankMembership $membership;

    protected function setUp(): void
    {
        parent::setUp();

        if (DB::getDriverName() !== 'pgsql') {
            $this->markTestSkipped('CHECK constraints are PostgreSQL-only; CI runs this suite on PostgreSQL.');
        }

        $bank = Bank::create(['name' => 'Familia', 'admin_email' => 'admin@example.com', 'status' => BankStatus::Active]);
        $this->membership = $bank->memberships()->create(['user_id' => User::factory()->create()->id]);
    }

    private function request(array $overrides = []): MoneyRequest
    {
        return MoneyRequest::create($overrides + [
            'id' => (string) Str::uuid(),
            'bank_id' => $this->membership->bank_id,
            'bank_membership_id' => $this->membership->id,
            'type' => 'expense',
            'requested_funding_source' => 'bank_funds',
            'funding_source' => 'bank_funds',
            'requested_amount_ars' => '15000.00',
            'amount_ars' => '15000.00',
            'created_by' => $this->membership->user_id,
        ]);
    }

    public function test_a_valid_request_is_accepted(): void
    {
        $this->assertTrue($this->request()->exists);
    }

    public function test_deposits_cannot_be_bank_funded(): void
    {
        $this->expectException(QueryException::class);
        $this->request(['type' => 'savings_deposit']);
    }

    public function test_amounts_must_be_positive(): void
    {
        $this->expectException(QueryException::class);
        $this->request(['amount_ars' => '0']);
    }

    public function test_reservations_cannot_exceed_the_balance(): void
    {
        $this->expectException(QueryException::class);
        SavingsAccount::create([
            'bank_id' => $this->membership->bank_id,
            'bank_membership_id' => $this->membership->id,
            'balance_usd' => '10.00',
            'reserved_usd' => '10.01',
        ]);
    }

    public function test_bank_status_is_restricted(): void
    {
        $this->expectException(QueryException::class);
        DB::table('banks')->insert(['admin_email' => 'x@example.com', 'status' => 'closed', 'timezone' => 'UTC']);
    }
}
