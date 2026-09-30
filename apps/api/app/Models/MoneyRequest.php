<?php

namespace App\Models;

use App\Enums\FundingSource;
use App\Enums\MoneyRequestStatus;
use App\Enums\MoneyRequestType;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class MoneyRequest extends Model
{
    use HasUuids;

    protected $fillable = [
        'id',
        'bank_id',
        'bank_membership_id',
        'type',
        'status',
        'requested_funding_source',
        'requested_amount_ars',
        'funding_source',
        'amount_ars',
        'exchange_rate',
        'amount_usd',
        'category',
        'description',
        'created_by',
        'confirmed_at',
        'confirmed_by',
        'rejected_at',
        'rejected_by',
        'rejection_reason',
        'canceled_at',
    ];

    protected function casts(): array
    {
        return [
            'type' => MoneyRequestType::class,
            'status' => MoneyRequestStatus::class,
            'requested_funding_source' => FundingSource::class,
            'funding_source' => FundingSource::class,
            'requested_amount_ars' => 'decimal:2',
            'amount_ars' => 'decimal:2',
            'exchange_rate' => 'decimal:4',
            'amount_usd' => 'decimal:2',
            'confirmed_at' => 'datetime',
            'rejected_at' => 'datetime',
            'canceled_at' => 'datetime',
        ];
    }

    public function bank(): BelongsTo
    {
        return $this->belongsTo(Bank::class);
    }

    public function membership(): BelongsTo
    {
        return $this->belongsTo(BankMembership::class, 'bank_membership_id');
    }

    public function reservation(): HasOne
    {
        return $this->hasOne(SavingsReservation::class);
    }

    public function ledgerEntry(): HasOne
    {
        return $this->hasOne(LedgerEntry::class);
    }
}
