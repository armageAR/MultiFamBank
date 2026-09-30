<?php

namespace App\Services;

use App\Enums\BankStatus;
use App\Exceptions\DomainRuleException;
use App\Models\AuditLog;
use App\Models\Bank;
use Illuminate\Support\Facades\DB;

class BankSetup
{
    /** Saves the bank's information; a bank pending configuration becomes active. */
    public function update(Bank $bank, string $name, string $timezone): Bank
    {
        return DB::transaction(function () use ($bank, $name, $timezone) {
            $bank = Bank::whereKey($bank->id)->lockForUpdate()->firstOrFail();

            if ($bank->status === BankStatus::Deactivated) {
                throw new DomainRuleException('bank', 'El banco está desactivado.');
            }

            $old = $bank->only(['name', 'timezone', 'status']);
            $bank->fill(['name' => $name, 'timezone' => $timezone]);

            if ($bank->status === BankStatus::PendingConfiguration) {
                $bank->status = BankStatus::Active;
                $bank->activated_at = now();
            }

            $bank->save();

            AuditLog::record('bank.configured', $bank, $bank->id, [
                'name' => $old['name'],
                'timezone' => $old['timezone'],
                'status' => $old['status']->value,
            ], [
                'name' => $bank->name,
                'timezone' => $bank->timezone,
                'status' => $bank->status->value,
            ]);

            return $bank;
        });
    }
}
