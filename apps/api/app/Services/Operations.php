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
use Illuminate\Database\UniqueConstraintViolationException;
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
 *
 * The administrator may correct a confirmed operation (amount, date) or delete it. Its ledger entry
 * is rewritten or removed in the same transaction, so balances and reports stay consistent, and the
 * client's balance may never have been negative at any point of their history.
 */
class Operations
{
    /** Largest amount the decimal(14,2) money columns hold. */
    private const MAX_USD = '999999999999.99';

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
            return $this->replay($existing, $membership, $input);
        }

        // A request queued offline, received, confirmed and then deleted must not come back when the
        // queue retries it with the same id.
        if (AuditLog::where('action', 'request.deleted')->where('subject_id', $id)->exists()) {
            throw new DomainRuleException('id', 'Este pedido ya fue recibido y después el administrador lo eliminó.');
        }

        $type = MoneyRequestType::from($input['type']);
        $description = $this->cleanDescription($input['description'] ?? null);
        $this->assertDescription($type, $description);

        // Fetched before the transaction: an external HTTP call must not hold row locks.
        $rate = $type === MoneyRequestType::Expense ? null : $this->quote($type);

        // The client may send the quote they were shown so exactly that rate is recorded, but it is
        // never authoritative: it must still be the current one.
        if ($rate !== null && isset($input['exchange_rate']) && bccomp((string) $input['exchange_rate'], $rate, 4) !== 0) {
            throw new DomainRuleException('exchange_rate', 'La cotización se actualizó: ahora es $ '.number_format((float) $rate, 2, ',', '.').'. Revisá el monto y volvé a confirmar.');
        }

        try {
            return DB::transaction(fn () => $this->createRequest($membership, $client, $input, $id, $type, $description, $rate), attempts: 3);
        } catch (UniqueConstraintViolationException) {
            // The same request arrived twice at the same moment (a retry); the first one won.
            return $this->replay(MoneyRequest::findOrFail($id), $membership, $input);
        }
    }

    private function createRequest(BankMembership $membership, User $client, array $input, string $id, MoneyRequestType $type, ?string $description, ?string $rate): MoneyRequest
    {
        $this->lockWritableBank($membership->bank_id);
        $membership = $this->lockActiveMembership($membership, 'Ya no sos cliente de este banco.');

        $request = new MoneyRequest([
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
            'created_by' => $client->id,
        ]);
        $this->refreshUsd($request);
        $request->save();

        $this->reserveIfWithdrawal($request);

        AuditLog::record('request.created', $request, $request->bank_id, null, $this->snapshot($request));

        return $request;
    }

    /** A retry with an id already used: the same request is returned, a different one is refused. */
    private function replay(MoneyRequest $existing, BankMembership $membership, array $input): MoneyRequest
    {
        $same = $existing->bank_membership_id === $membership->id
            && $existing->requested_type->value === $input['type']
            && bccomp((string) $existing->requested_amount_ars, (string) $input['amount_ars'], 2) === 0;

        if (! $same) {
            throw new DomainRuleException('id', 'Ese identificador de pedido ya se usó para otro pedido.');
        }

        return $existing;
    }

    /**
     * Administrator edits on a pending request: type, amount, comment, operation date and rate.
     *
     * @param  array{type?: string, amount_ars?: string, description?: string|null, occurred_at?: string|null, exchange_rate?: string|null}  $changes
     */
    public function update(MoneyRequest $request, User $admin, array $changes): MoneyRequest
    {
        $changes = $this->withQuoteForNewType($request, $changes);

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
        $changes = $this->withQuoteForNewType($request, $changes);

        return DB::transaction(function () use ($request, $admin, $changes) {
            $this->lockWritableBank($request->bank_id);
            $request = $this->lockPending($request);
            $before = $this->snapshot($request);

            $reservation = $this->releaseReservation($request);
            $this->apply($request, $changes);
            $this->settle($request, $admin);

            // The reserved dollars were paid out only if it is still a withdrawal.
            if ($reservation && $request->type === MoneyRequestType::SavingsWithdrawal) {
                $reservation->forceFill(['released_at' => null, 'settled_at' => now()])->save();
            }

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
            $membership = $this->lockActiveMembership($membership, 'Esta persona ya no es cliente del banco.');

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
            $earliest = $request->occurred_at?->min(Carbon::parse($occurredAt)) ?? Carbon::parse($occurredAt);
            $request->forceFill(['occurred_at' => Carbon::parse($occurredAt)])->save();
            LedgerEntry::where('money_request_id', $request->id)->update(['occurred_at' => $request->occurred_at]);
            // Moving a deposit after a withdrawal it paid for would leave the balance negative in between.
            $this->assertHistoryNeverNegative($request, $earliest, 'occurred_at');

            AuditLog::record('request.date_changed', $request, $request->bank_id, ['occurred_at' => $before], ['occurred_at' => $request->occurred_at->toIso8601String()]);

            return $request;
        }, attempts: 3);
    }

    /**
     * Corrects the amount of a confirmed operation. Savings operations keep their recorded rate: the
     * dollars are recalculated and the difference is applied to the balance.
     */
    public function changeAmount(MoneyRequest $request, User $admin, string $amountArs): MoneyRequest
    {
        return DB::transaction(function () use ($request, $amountArs) {
            $this->lockWritableBank($request->bank_id);
            $request = $this->lockConfirmed($request, 'amount_ars', 'Solo se puede modificar el importe de operaciones confirmadas; un pedido pendiente se edita al revisarlo.');
            $before = $this->snapshot($request);
            $oldUsd = (string) $request->amount_usd;

            $request->amount_ars = $amountArs;
            $this->refreshUsd($request);

            if ($request->type !== MoneyRequestType::Expense) {
                // Dollars that leave the balance: more for a bigger withdrawal, less for a smaller deposit.
                $out = $request->type === MoneyRequestType::SavingsWithdrawal
                    ? Money::sub((string) $request->amount_usd, $oldUsd)
                    : Money::sub($oldUsd, (string) $request->amount_usd);
                $this->moveBalance($request, $out, 'amount_ars', 'No alcanza el saldo para este cambio');
            }

            $request->save();
            LedgerEntry::where('money_request_id', $request->id)->update(['amount_ars' => $request->amount_ars, 'amount_usd' => $request->amount_usd]);
            SavingsReservation::where('money_request_id', $request->id)->whereNotNull('settled_at')->update(['amount_usd' => $request->amount_usd]);
            $this->assertHistoryNeverNegative($request, $request->occurred_at, 'amount_ars');

            AuditLog::record('request.amount_changed', $request, $request->bank_id, $before, $this->snapshot($request));

            return $request;
        }, attempts: 3);
    }

    /**
     * Deletes a confirmed operation as if it never happened: its effect on the balance is undone and
     * it leaves the history and the reports. The audit log keeps what it was.
     */
    public function delete(MoneyRequest $request, User $admin): MoneyRequest
    {
        return DB::transaction(function () use ($request) {
            $this->lockWritableBank($request->bank_id);
            $request = $this->lockConfirmed($request, 'request', 'Solo se pueden eliminar operaciones confirmadas; un pedido pendiente se rechaza.');
            // The row goes away: the audit log keeps everything needed to know whose operation it was.
            $before = $this->snapshot($request) + [
                'bank_membership_id' => $request->bank_membership_id,
                'requested_type' => $request->requested_type->value,
                'requested_amount_ars' => (string) $request->requested_amount_ars,
                'requested_description' => $request->requested_description,
                'created_by' => $request->created_by,
                'confirmed_by' => $request->confirmed_by,
                'confirmed_at' => $request->confirmed_at?->toIso8601String(),
            ];

            if ($request->type !== MoneyRequestType::Expense) {
                $usd = (string) $request->amount_usd;
                // Deleting a deposit takes its dollars back; deleting a withdrawal returns them.
                $out = $request->type === MoneyRequestType::SavingsDeposit ? $usd : Money::sub('0', $usd);
                $this->moveBalance($request, $out, 'request', 'No se puede eliminar este depósito');
            }

            LedgerEntry::where('money_request_id', $request->id)->delete();
            SavingsReservation::where('money_request_id', $request->id)->delete();
            $request->delete();
            $this->assertHistoryNeverNegative($request, $request->occurred_at, 'request');

            AuditLog::record('request.deleted', $request, $request->bank_id, $before);

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

    private function lockConfirmed(MoneyRequest $request, string $field, string $message): MoneyRequest
    {
        $request = MoneyRequest::whereKey($request->id)->lockForUpdate()->firstOrFail();

        if ($request->status !== MoneyRequestStatus::Confirmed) {
            throw new DomainRuleException($field, $message);
        }

        return $request;
    }

    /**
     * Takes `$out` dollars out of the client's savings (a negative amount puts them back). The
     * available balance may never go negative: those dollars may already have been withdrawn.
     */
    private function moveBalance(MoneyRequest $request, string $out, string $field, string $insufficient): void
    {
        $account = $this->account($request);

        if (Money::greaterThan($out, $account->availableUsd())) {
            throw new DomainRuleException($field, "$insufficient: el saldo disponible es USD {$account->availableUsd()}.");
        }

        $account->balance_usd = Money::sub((string) $account->balance_usd, $out);

        if (Money::greaterThan((string) $account->balance_usd, self::MAX_USD)) {
            throw new DomainRuleException($field, 'El saldo resultante es demasiado grande.');
        }

        $account->save();
    }

    /**
     * Walks the client's savings backwards from today's balance to `$from` and refuses if the balance
     * after any of those movements is negative: a correction may not leave an earlier withdrawal
     * without the dollars it took. Runs after the ledger was updated, inside the same transaction
     * (the savings account is locked), so an exception undoes the correction.
     */
    private function assertHistoryNeverNegative(MoneyRequest $request, ?Carbon $from, string $field): void
    {
        if ($request->type === MoneyRequestType::Expense || $from === null) {
            return;
        }

        $account = $this->account($request);
        $balance = (string) $account->balance_usd;
        $entries = LedgerEntry::where('savings_account_id', $account->id)->where('occurred_at', '>=', $from)
            ->orderByDesc('occurred_at')->orderByDesc('id')->get(['kind', 'amount_usd', 'occurred_at']);

        foreach ($entries as $entry) {
            if (bccomp($balance, '0', 2) < 0) {
                $this->refuseNegativeHistory($request, $entry->occurred_at, $balance, $field);
            }

            $balance = $entry->kind === LedgerEntryKind::SavingsCredit
                ? Money::sub($balance, (string) $entry->amount_usd)
                : Money::add($balance, (string) $entry->amount_usd);
        }
    }

    private function refuseNegativeHistory(MoneyRequest $request, Carbon $when, string $balance, string $field): never
    {
        $date = $when->timezone($request->bank()->value('timezone') ?? config('app.timezone'))->format('d/m/Y');

        throw new DomainRuleException($field, "No se puede: el saldo del $date quedaría en USD $balance. Ese día ya se había retirado esa plata.");
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
        }

        $this->refreshUsd($request);
    }

    /**
     * When the administrator changes the type into a savings operation without giving a rate, the
     * rate of the new type is quoted now (deposits blue sell, withdrawals blue buy), outside of any
     * transaction so no row stays locked during the HTTP call.
     */
    private function withQuoteForNewType(MoneyRequest $request, array $changes): array
    {
        $newType = isset($changes['type']) ? MoneyRequestType::from($changes['type']) : null;

        if ($newType && $newType !== MoneyRequestType::Expense && $newType !== $request->type && empty($changes['exchange_rate'])) {
            $changes['exchange_rate'] = $this->quote($newType);
        }

        return $changes;
    }

    private function lockActiveMembership(BankMembership $membership, string $message): BankMembership
    {
        // Shared lock: a concurrent deactivation (FOR UPDATE) waits, or this sees it as removed.
        $membership = BankMembership::whereKey($membership->id)->sharedLock()->firstOrFail();

        if ($membership->status !== MembershipStatus::Active) {
            throw new DomainRuleException('bank', $message);
        }

        return $membership;
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

        $usd = Money::arsToUsd((string) $request->amount_ars, (string) $request->exchange_rate);

        if (bccomp($usd, '0', 2) <= 0) {
            throw new DomainRuleException('amount_ars', 'El monto es demasiado chico para convertirlo a dólares.');
        }

        if (Money::greaterThan($usd, self::MAX_USD)) {
            throw new DomainRuleException('exchange_rate', 'El monto en dólares es demasiado grande. Revisá la cotización.');
        }

        $request->amount_usd = $usd;
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

    /** Gives back the reserved USD and returns the reservation, if there was one. */
    private function releaseReservation(MoneyRequest $request): ?SavingsReservation
    {
        $reservation = SavingsReservation::where('money_request_id', $request->id)
            ->whereNull('released_at')->whereNull('settled_at')->lockForUpdate()->first();

        if (! $reservation) {
            return null;
        }

        $account = $this->account($request);
        $account->reserved_usd = Money::sub((string) $account->reserved_usd, (string) $reservation->amount_usd);
        $account->save();

        $reservation->forceFill(['released_at' => now()])->save();

        return $reservation;
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

                if (Money::greaterThan((string) $account->balance_usd, self::MAX_USD)) {
                    throw new DomainRuleException('amount_ars', 'El saldo resultante es demasiado grande.');
                }
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
