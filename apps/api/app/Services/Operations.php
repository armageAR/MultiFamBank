<?php

namespace App\Services;

use App\Enums\BankStatus;
use App\Enums\LedgerEntryKind;
use App\Enums\MembershipStatus;
use App\Enums\MoneyRequestStatus;
use App\Enums\MoneyRequestType;
use App\Exceptions\DomainRuleException;
use App\Exceptions\ExchangeRateUnavailableException;
use App\Models\AuditLog;
use App\Models\Bank;
use App\Models\BankMembership;
use App\Models\LedgerEntry;
use App\Models\MoneyRequest;
use App\Models\SavingsAccount;
use App\Models\SavingsReservation;
use App\Models\User;
use App\Support\Money;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Money operations of a bank: deposits and withdrawals move the client's USD savings (entered in
 * ARS, converted at a recorded rate); expenses are paid with bank money and never touch savings.
 *
 * Every write locks the bank (shared, so a pause or deactivation cannot interleave), then the
 * request, then the savings account. Pending withdrawals reserve USD so the available balance can
 * never go negative; the reservation is released or settled exactly once.
 */
class Operations
{
    public function __construct(private ExchangeRates $rates) {}

    /**
     * A client's request. The id is the client-generated UUID: retrying with the same id returns the
     * existing request instead of creating a second one.
     *
     * @param  array{id?: string|null, type: string, amount_ars: string, description?: string|null}  $input
     */
    public function request(BankMembership $membership, User $client, array $input): MoneyRequest
    {
        $id = $input['id'] ?? (string) Str::uuid();

        if ($existing = MoneyRequest::find($id)) {
            if ($existing->bank_membership_id !== $membership->id) {
                throw new DomainRuleException('id', 'Ese identificador de pedido ya existe.');
            }

            return $existing;
        }

        $type = MoneyRequestType::from($input['type']);
        $description = $this->cleanDescription($input['description'] ?? null);
        $this->assertDescription($type, $description);

        // Fetched before the transaction: an external HTTP call must not hold row locks.
        $rate = $type === MoneyRequestType::Expense ? null : $this->quote($type);

        return DB::transaction(function () use ($membership, $client, $input, $id, $type, $description, $rate) {
            $this->lockWritableBank($membership->bank_id);
            $membership = BankMembership::whereKey($membership->id)->firstOrFail();

            if ($membership->status !== MembershipStatus::Active) {
                throw new DomainRuleException('bank', 'Ya no sos cliente de este banco.');
            }

            $request = MoneyRequest::create([
                'id' => $id,
                'bank_id' => $membership->bank_id,
                'bank_membership_id' => $membership->id,
                'type' => $type,
                'requested_type' => $type,
                'status' => MoneyRequestStatus::Pending,
                'requested_amount_ars' => $input['amount_ars'],
                'amount_ars' => $input['amount_ars'],
                'requested_description' => $description,
                'description' => $description,
                'exchange_rate' => $rate,
                'amount_usd' => $rate ? Money::arsToUsd($input['amount_ars'], $rate) : null,
                'created_by' => $client->id,
            ]);

            $this->reserveIfWithdrawal($request);

            AuditLog::record('request.created', $request, $request->bank_id, null, $this->snapshot($request));

            return $request;
        }, attempts: 3);
    }

    /**
     * Administrator edits on a pending request: type, amount, comment, operation date and rate.
     *
     * @param  array{type?: string, amount_ars?: string, description?: string|null, occurred_at?: string|null, exchange_rate?: string|null}  $changes
     */
    public function update(MoneyRequest $request, User $admin, array $changes): MoneyRequest
    {
        return DB::transaction(function () use ($request, $changes) {
            $this->lockWritableBank($request->bank_id);
            $request = $this->lockPending($request);
            $before = $this->snapshot($request);

            $this->releaseReservation($request);
            $this->apply($request, $changes);
            $request->save();
            $this->reserveIfWithdrawal($request);

            AuditLog::record('request.updated', $request, $request->bank_id, $before, $this->snapshot($request));

            return $request;
        }, attempts: 3);
    }

    /**
     * Confirms that the money changed hands, optionally applying final edits first.
     *
     * @param  array{type?: string, amount_ars?: string, description?: string|null, occurred_at?: string|null, exchange_rate?: string|null}  $changes
     */
    public function confirm(MoneyRequest $request, User $admin, array $changes = []): MoneyRequest
    {
        return DB::transaction(function () use ($request, $admin, $changes) {
            $this->lockWritableBank($request->bank_id);
            $request = $this->lockPending($request);
            $before = $this->snapshot($request);

            $this->releaseReservation($request, settle: true);
            $this->apply($request, $changes);
            $this->settle($request, $admin);

            AuditLog::record('request.confirmed', $request, $request->bank_id, $before, $this->snapshot($request));

            return $request;
        }, attempts: 3);
    }

    public function reject(MoneyRequest $request, User $admin, ?string $reason = null): MoneyRequest
    {
        return DB::transaction(function () use ($request, $admin, $reason) {
            $this->lockWritableBank($request->bank_id);
            $request = $this->lockPending($request);

            $this->releaseReservation($request);
            $request->forceFill([
                'status' => MoneyRequestStatus::Rejected,
                'rejected_at' => now(),
                'rejected_by' => $admin->id,
                'rejection_reason' => $this->cleanDescription($reason),
            ])->save();

            AuditLog::record('request.rejected', $request, $request->bank_id, null, ['reason' => $request->rejection_reason]);

            return $request;
        }, attempts: 3);
    }

    /** A client withdraws their own pending request. */
    public function cancel(MoneyRequest $request, User $client): MoneyRequest
    {
        return DB::transaction(function () use ($request) {
            $this->lockWritableBank($request->bank_id);
            $request = $this->lockPending($request);

            $this->releaseReservation($request);
            $request->forceFill(['status' => MoneyRequestStatus::Canceled, 'canceled_at' => now()])->save();

            AuditLog::record('request.canceled', $request, $request->bank_id);

            return $request;
        }, attempts: 3);
    }

    /**
     * An operation that already happened outside the app, recorded and confirmed at once by the
     * administrator (as in FamBank).
     *
     * @param  array{type: string, amount_ars: string, description?: string|null, occurred_at?: string|null, exchange_rate?: string|null}  $input
     */
    public function record(BankMembership $membership, User $admin, array $input): MoneyRequest
    {
        $type = MoneyRequestType::from($input['type']);
        $description = $this->cleanDescription($input['description'] ?? null);
        $this->assertDescription($type, $description);

        return DB::transaction(function () use ($membership, $admin, $input, $type, $description) {
            $this->lockWritableBank($membership->bank_id);

            if ($membership->fresh()->status !== MembershipStatus::Active) {
                throw new DomainRuleException('bank', 'Esta persona ya no es cliente del banco.');
            }

            $request = new MoneyRequest([
                'id' => (string) Str::uuid(),
                'bank_id' => $membership->bank_id,
                'bank_membership_id' => $membership->id,
                'type' => $type,
                'requested_type' => $type,
                'status' => MoneyRequestStatus::Pending,
                'requested_amount_ars' => $input['amount_ars'],
                'amount_ars' => $input['amount_ars'],
                'requested_description' => $description,
                'description' => $description,
                'exchange_rate' => $type === MoneyRequestType::Expense ? null : ($input['exchange_rate'] ?? null),
                'occurred_at' => $input['occurred_at'] ?? null,
                'created_by' => $admin->id,
            ]);
            $this->refreshUsd($request);
            $this->settle($request, $admin);

            AuditLog::record('request.recorded', $request, $request->bank_id, null, $this->snapshot($request));

            return $request;
        }, attempts: 3);
    }

    /** Corrects when a confirmed operation happened; balances do not change. */
    public function changeDate(MoneyRequest $request, User $admin, string $occurredAt): MoneyRequest
    {
        return DB::transaction(function () use ($request, $occurredAt) {
            $this->lockWritableBank($request->bank_id);
            $request = MoneyRequest::whereKey($request->id)->lockForUpdate()->firstOrFail();

            if ($request->status !== MoneyRequestStatus::Confirmed) {
                throw new DomainRuleException('occurred_at', 'Solo se puede cambiar la fecha de operaciones confirmadas; en un pedido pendiente se edita junto con el resto.');
            }

            $before = $request->occurred_at?->toIso8601String();
            $request->forceFill(['occurred_at' => Carbon::parse($occurredAt)])->save();
            LedgerEntry::where('money_request_id', $request->id)->update(['occurred_at' => $request->occurred_at]);

            AuditLog::record('request.date_changed', $request, $request->bank_id, ['occurred_at' => $before], ['occurred_at' => $request->occurred_at->toIso8601String()]);

            return $request;
        }, attempts: 3);
    }

    // ── internals ─────────────────────────────────────────────────────────────

    /** Shared lock: concurrent operations proceed, but a pause or deactivation waits for them. */
    private function lockWritableBank(int $bankId): Bank
    {
        $bank = Bank::whereKey($bankId)->sharedLock()->firstOrFail();

        if ($bank->status === BankStatus::Paused) {
            throw new DomainRuleException('bank', 'Las operaciones del banco están pausadas. Comunicate con el administrador.');
        }

        if ($bank->status !== BankStatus::Active) {
            throw new DomainRuleException('bank', 'El banco no está disponible.');
        }

        return $bank;
    }

    private function lockPending(MoneyRequest $request): MoneyRequest
    {
        $request = MoneyRequest::whereKey($request->id)->lockForUpdate()->firstOrFail();

        if ($request->status !== MoneyRequestStatus::Pending) {
            throw new DomainRuleException('request', 'El pedido ya no está pendiente.');
        }

        return $request;
    }

    /** @param  array<string, mixed>  $changes */
    private function apply(MoneyRequest $request, array $changes): void
    {
        if (array_key_exists('type', $changes)) {
            $request->type = MoneyRequestType::from($changes['type']);
        }

        if (array_key_exists('amount_ars', $changes)) {
            $request->amount_ars = $changes['amount_ars'];
        }

        if (array_key_exists('description', $changes)) {
            $request->description = $this->cleanDescription($changes['description']);
        }

        if (array_key_exists('occurred_at', $changes)) {
            $request->occurred_at = $changes['occurred_at'] ? Carbon::parse($changes['occurred_at']) : null;
        }

        if (array_key_exists('exchange_rate', $changes) && $changes['exchange_rate'] !== null) {
            $request->exchange_rate = $changes['exchange_rate'];
        }

        $this->assertDescription($request->type, $request->description);

        if ($request->type === MoneyRequestType::Expense) {
            $request->exchange_rate = null;
        } elseif ($request->exchange_rate === null) {
            // E.g. an expense turned into a withdrawal: start from today's quote; the
            // administrator can still adjust it.
            $request->exchange_rate = $this->quote($request->type);
        }

        $this->refreshUsd($request);
    }

    private function quote(MoneyRequestType $type): string
    {
        try {
            return $this->rates->forClientRequest($type === MoneyRequestType::SavingsDeposit);
        } catch (ExchangeRateUnavailableException $e) {
            throw new DomainRuleException('exchange_rate', $e->getMessage());
        }
    }

    private function refreshUsd(MoneyRequest $request): void
    {
        if ($request->type === MoneyRequestType::Expense) {
            $request->amount_usd = null;

            return;
        }

        if ($request->exchange_rate === null || bccomp((string) $request->exchange_rate, '0', 4) <= 0) {
            throw new DomainRuleException('exchange_rate', 'Indicá la cotización para convertir a dólares.');
        }

        $request->amount_usd = Money::arsToUsd((string) $request->amount_ars, (string) $request->exchange_rate);
    }

    private function account(MoneyRequest $request): SavingsAccount
    {
        return SavingsAccount::where('bank_membership_id', $request->bank_membership_id)->lockForUpdate()->firstOrFail();
    }

    private function reserveIfWithdrawal(MoneyRequest $request): void
    {
        if ($request->type !== MoneyRequestType::SavingsWithdrawal) {
            return;
        }

        $account = $this->account($request);
        $this->assertAvailable($account, (string) $request->amount_usd);

        SavingsReservation::updateOrCreate(
            ['money_request_id' => $request->id],
            ['savings_account_id' => $account->id, 'amount_usd' => $request->amount_usd, 'released_at' => null, 'settled_at' => null],
        );
        $account->reserved_usd = Money::add((string) $account->reserved_usd, (string) $request->amount_usd);
        $account->save();
    }

    /** Gives back the reserved USD; on confirmation the reservation is marked settled instead. */
    private function releaseReservation(MoneyRequest $request, bool $settle = false): void
    {
        $reservation = SavingsReservation::where('money_request_id', $request->id)
            ->whereNull('released_at')->whereNull('settled_at')->lockForUpdate()->first();

        if (! $reservation) {
            return;
        }

        $account = $this->account($request);
        $account->reserved_usd = Money::sub((string) $account->reserved_usd, (string) $reservation->amount_usd);
        $account->save();

        $reservation->forceFill([$settle ? 'settled_at' : 'released_at' => now()])->save();
    }

    /** Moves the money and writes the ledger entry; the request must not hold a live reservation. */
    private function settle(MoneyRequest $request, User $admin): void
    {
        $account = null;

        if ($request->type !== MoneyRequestType::Expense) {
            $account = $this->account($request);
            $usd = (string) $request->amount_usd;

            if ($request->type === MoneyRequestType::SavingsWithdrawal) {
                $this->assertAvailable($account, $usd);
                $account->balance_usd = Money::sub((string) $account->balance_usd, $usd);
            } else {
                $account->balance_usd = Money::add((string) $account->balance_usd, $usd);
            }

            $account->save();
        }

        $request->forceFill([
            'status' => MoneyRequestStatus::Confirmed,
            'confirmed_at' => now(),
            'confirmed_by' => $admin->id,
            'occurred_at' => $request->occurred_at ?? now(),
        ])->save();

        LedgerEntry::create([
            'bank_id' => $request->bank_id,
            'bank_membership_id' => $request->bank_membership_id,
            'savings_account_id' => $account?->id,
            'money_request_id' => $request->id,
            'kind' => match ($request->type) {
                MoneyRequestType::SavingsDeposit => LedgerEntryKind::SavingsCredit,
                MoneyRequestType::SavingsWithdrawal => LedgerEntryKind::SavingsDebit,
                MoneyRequestType::Expense => LedgerEntryKind::BankExpense,
            },
            'amount_ars' => $request->amount_ars,
            'exchange_rate' => $request->exchange_rate,
            'amount_usd' => $request->amount_usd,
            'description' => $request->description,
            'occurred_at' => $request->occurred_at,
            'created_by' => $admin->id,
        ]);
    }

    private function assertAvailable(SavingsAccount $account, string $usd): void
    {
        $available = $account->availableUsd();

        if (Money::greaterThan($usd, $available)) {
            throw new DomainRuleException('amount_ars', "Saldo insuficiente. El saldo disponible es USD {$available}.");
        }
    }

    private function assertDescription(MoneyRequestType $type, ?string $description): void
    {
        if ($type->requiresDescription() && $description === null) {
            throw new DomainRuleException('description', 'Para un gasto hay que explicar para qué es la plata.');
        }
    }

    private function cleanDescription(?string $value): ?string
    {
        $value = $value === null ? null : trim($value);

        return $value === '' ? null : $value;
    }

    /** @return array<string, mixed> */
    private function snapshot(MoneyRequest $request): array
    {
        return [
            'type' => $request->type->value,
            'amount_ars' => (string) $request->amount_ars,
            'description' => $request->description,
            'exchange_rate' => $request->exchange_rate === null ? null : (string) $request->exchange_rate,
            'amount_usd' => $request->amount_usd === null ? null : (string) $request->amount_usd,
            'occurred_at' => $request->occurred_at?->toIso8601String(),
            'status' => $request->status->value,
        ];
    }
}
