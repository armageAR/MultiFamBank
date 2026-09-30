<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SavingsAccount extends Model
{
    protected $fillable = ['bank_id', 'bank_membership_id', 'balance_usd', 'reserved_usd'];

    protected function casts(): array
    {
        return [
            'balance_usd' => 'decimal:2',
            'reserved_usd' => 'decimal:2',
        ];
    }

    /** Confirmed balance minus funds reserved by pending withdrawals, as a decimal string. */
    public function availableUsd(): string
    {
        return bcsub((string) $this->balance_usd, (string) $this->reserved_usd, 2);
    }

    public function bank(): BelongsTo
    {
        return $this->belongsTo(Bank::class);
    }

    public function membership(): BelongsTo
    {
        return $this->belongsTo(BankMembership::class, 'bank_membership_id');
    }

    public function reservations(): HasMany
    {
        return $this->hasMany(SavingsReservation::class);
    }
}
