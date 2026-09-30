<?php

namespace App\Models;

use App\Enums\LedgerEntryKind;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LedgerEntry extends Model
{
    protected $fillable = [
        'bank_id',
        'bank_membership_id',
        'savings_account_id',
        'money_request_id',
        'kind',
        'amount_ars',
        'exchange_rate',
        'amount_usd',
        'category',
        'description',
        'occurred_at',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'kind' => LedgerEntryKind::class,
            'amount_ars' => 'decimal:2',
            'exchange_rate' => 'decimal:4',
            'amount_usd' => 'decimal:2',
            'occurred_at' => 'datetime',
        ];
    }

    public function bank(): BelongsTo
    {
        return $this->belongsTo(Bank::class);
    }

    public function moneyRequest(): BelongsTo
    {
        return $this->belongsTo(MoneyRequest::class);
    }
}
