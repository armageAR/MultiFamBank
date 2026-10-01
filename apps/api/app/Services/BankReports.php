<?php

namespace App\Services;

use App\Enums\LedgerEntryKind;
use App\Enums\MembershipStatus;
use App\Enums\MoneyRequestStatus;
use App\Models\Bank;
use App\Models\LedgerEntry;
use App\Models\SavingsAccount;
use App\Support\Money;
use Illuminate\Support\Carbon;

/** Read-only figures for the administrator. Months follow the bank's timezone and the operation date. */
class BankReports
{
    public function dashboard(Bank $bank): array
    {
        $accounts = SavingsAccount::where('bank_id', $bank->id)->get(['balance_usd', 'reserved_usd']);
        $balance = $accounts->reduce(fn ($sum, $a) => Money::add($sum, (string) $a->balance_usd), '0.00');
        $reserved = $accounts->reduce(fn ($sum, $a) => Money::add($sum, (string) $a->reserved_usd), '0.00');
        [$from, $to] = $this->monthRange($bank, now($bank->timezone)->format('Y-m'));

        return [
            'balance_usd' => $balance,
            'reserved_usd' => $reserved,
            'available_usd' => Money::sub($balance, $reserved),
            'clients' => $bank->memberships()->where('status', MembershipStatus::Active)->count(),
            'pending_requests' => $bank->moneyRequests()->where('status', MoneyRequestStatus::Pending)->count(),
            'month' => now($bank->timezone)->format('Y-m'),
            'month_expenses_ars' => $this->sum($bank, LedgerEntryKind::BankExpense, $from, $to, 'amount_ars'),
        ];
    }

    /** Bank-funded expenses of a month (YYYY-MM), in total and by client, plus savings movements apart. */
    public function monthlyExpenses(Bank $bank, string $month): array
    {
        [$from, $to] = $this->monthRange($bank, $month);

        $expenses = LedgerEntry::with('membership.user')
            ->where('bank_id', $bank->id)
            ->where('kind', LedgerEntryKind::BankExpense)
            ->whereBetween('occurred_at', [$from, $to])
            ->orderBy('occurred_at')
            ->get();

        $byClient = $expenses->groupBy('bank_membership_id')->map(fn ($entries) => [
            'membership_id' => $entries->first()->bank_membership_id,
            'name' => $entries->first()->membership->user->name,
            'total_ars' => $entries->reduce(fn ($sum, $e) => Money::add($sum, (string) $e->amount_ars), '0.00'),
            'expenses' => $entries->map(fn ($e) => [
                'money_request_id' => $e->money_request_id,
                'occurred_at' => $e->occurred_at,
                'amount_ars' => (string) $e->amount_ars,
                'description' => $e->description,
            ])->values(),
        ])->sort(fn ($a, $b) => bccomp($b['total_ars'], $a['total_ars'], 2))->values();

        return [
            'month' => $month,
            'timezone' => $bank->timezone,
            'total_ars' => $expenses->reduce(fn ($sum, $e) => Money::add($sum, (string) $e->amount_ars), '0.00'),
            'by_client' => $byClient,
            // Savings movements are the clients' own money: shown apart, never counted as expenses.
            'savings' => [
                'deposits_ars' => $this->sum($bank, LedgerEntryKind::SavingsCredit, $from, $to, 'amount_ars'),
                'deposits_usd' => $this->sum($bank, LedgerEntryKind::SavingsCredit, $from, $to, 'amount_usd'),
                'withdrawals_ars' => $this->sum($bank, LedgerEntryKind::SavingsDebit, $from, $to, 'amount_ars'),
                'withdrawals_usd' => $this->sum($bank, LedgerEntryKind::SavingsDebit, $from, $to, 'amount_usd'),
            ],
        ];
    }

    /** @return array{0: Carbon, 1: Carbon} UTC bounds of a calendar month in the bank's timezone. */
    private function monthRange(Bank $bank, string $month): array
    {
        $start = Carbon::createFromFormat('Y-m-d H:i:s', "$month-01 00:00:00", $bank->timezone);

        return [$start->copy()->utc(), $start->copy()->endOfMonth()->utc()];
    }

    private function sum(Bank $bank, LedgerEntryKind $kind, Carbon $from, Carbon $to, string $column): string
    {
        $total = LedgerEntry::where('bank_id', $bank->id)->where('kind', $kind)->whereBetween('occurred_at', [$from, $to])
            ->toBase()->selectRaw("coalesce(sum($column), 0) as total")->value('total');

        // Decimal string straight from the database; no float conversion.
        return bcadd((string) $total, '0', 2);
    }
}
