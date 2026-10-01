<?php

namespace App\Services;

use App\Enums\BankStatus;
use App\Exceptions\DomainRuleException;
use App\Models\AuditLog;
use App\Models\Bank;
use Illuminate\Support\Facades\DB;

/**
 * Superadmin lifecycle actions. Paused banks are read-only for their members; deactivated banks
 * disappear for them until reactivated. History is never deleted and the admin email stays reserved.
 */
class BankLifecycle
{
    public function pause(Bank $bank): Bank
    {
        return $this->transition($bank, 'bank.paused', function (Bank $bank) {
            $this->require($bank, [BankStatus::Active], 'Solo se puede pausar un banco activo.');
            $bank->status = BankStatus::Paused;
            $bank->paused_at = now();
        });
    }

    public function resume(Bank $bank): Bank
    {
        return $this->transition($bank, 'bank.resumed', function (Bank $bank) {
            $this->require($bank, [BankStatus::Paused], 'El banco no está pausado.');
            $bank->status = BankStatus::Active;
            $bank->paused_at = null;
        });
    }

    public function deactivate(Bank $bank): Bank
    {
        return $this->transition($bank, 'bank.deactivated', function (Bank $bank) {
            $this->require(
                $bank,
                [BankStatus::PendingConfiguration, BankStatus::Active, BankStatus::Paused],
                'El banco ya está desactivado.',
            );
            $bank->status = BankStatus::Deactivated;
            $bank->deactivated_at = now();
            $bank->paused_at = null;
        });
    }

    /** Returns the bank to active, or to pending configuration if its administrator never set it up. */
    public function reactivate(Bank $bank): Bank
    {
        return $this->transition($bank, 'bank.reactivated', function (Bank $bank) {
            $this->require($bank, [BankStatus::Deactivated], 'El banco no está desactivado.');
            $bank->status = $bank->activated_at ? BankStatus::Active : BankStatus::PendingConfiguration;
            $bank->deactivated_at = null;
        });
    }

    /** @param  callable(Bank): void  $change */
    private function transition(Bank $bank, string $action, callable $change): Bank
    {
        return DB::transaction(function () use ($bank, $action, $change) {
            $bank = Bank::whereKey($bank->id)->lockForUpdate()->firstOrFail();
            $from = $bank->status;

            $change($bank);
            $bank->save();

            AuditLog::record($action, $bank, $bank->id, ['status' => $from->value], ['status' => $bank->status->value]);

            return $bank;
        }, attempts: 3);
    }

    /** @param  list<BankStatus>  $allowed */
    private function require(Bank $bank, array $allowed, string $message): void
    {
        if (! in_array($bank->status, $allowed, true)) {
            throw new DomainRuleException('status', $message);
        }
    }
}
