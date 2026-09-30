<?php

namespace App\Models;

use App\Enums\BankStatus;
use App\Enums\InvitationType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Bank extends Model
{
    protected $fillable = [
        'name',
        'timezone',
        'status',
        'admin_email',
        'admin_user_id',
        'created_by',
        'activated_at',
        'paused_at',
        'deactivated_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => BankStatus::class,
            'activated_at' => 'datetime',
            'paused_at' => 'datetime',
            'deactivated_at' => 'datetime',
        ];
    }

    public function admin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'admin_user_id');
    }

    public function memberships(): HasMany
    {
        return $this->hasMany(BankMembership::class);
    }

    public function invitations(): HasMany
    {
        return $this->hasMany(Invitation::class);
    }

    /** The most recent administrator invitation. */
    public function adminInvitation(): HasOne
    {
        return $this->hasOne(Invitation::class)
            ->ofMany(['id' => 'max'], fn ($query) => $query->where('type', InvitationType::BankAdmin));
    }

    public function moneyRequests(): HasMany
    {
        return $this->hasMany(MoneyRequest::class);
    }
}
