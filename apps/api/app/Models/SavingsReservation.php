<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SavingsReservation extends Model
{
    protected $fillable = ['savings_account_id', 'money_request_id', 'amount_usd', 'released_at', 'settled_at'];

    protected function casts(): array
    {
        return [
            'amount_usd' => 'decimal:2',
            'released_at' => 'datetime',
            'settled_at' => 'datetime',
        ];
    }

    public function savingsAccount(): BelongsTo
    {
        return $this->belongsTo(SavingsAccount::class);
    }

    public function moneyRequest(): BelongsTo
    {
        return $this->belongsTo(MoneyRequest::class);
    }
}
