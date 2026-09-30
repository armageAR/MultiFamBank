<?php

namespace App\Models;

use App\Enums\MembershipStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class BankMembership extends Model
{
    protected $fillable = ['bank_id', 'user_id', 'status'];

    protected function casts(): array
    {
        return ['status' => MembershipStatus::class];
    }

    public function bank(): BelongsTo
    {
        return $this->belongsTo(Bank::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function savingsAccount(): HasOne
    {
        return $this->hasOne(SavingsAccount::class);
    }
}
