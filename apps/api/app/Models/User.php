<?php

namespace App\Models;

use App\Enums\BankStatus;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'email_verified_at',
    ];

    /**
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'last_seen_at' => 'datetime',
            'password' => 'hashed',
            'is_superadmin' => 'boolean',
            'active' => 'boolean',
        ];
    }

    /** Emails identify a person globally, so they are stored trimmed and lowercased. */
    public static function normalizeEmail(string $email): string
    {
        return mb_strtolower(trim($email));
    }

    protected function email(): Attribute
    {
        return Attribute::set(fn (string $value) => self::normalizeEmail($value));
    }

    /** The bank this user administers, if any (at most one). */
    public function administeredBank(): HasOne
    {
        return $this->hasOne(Bank::class, 'admin_user_id');
    }

    /** The administered bank as its administrator sees it: a deactivated bank does not exist for them. */
    public function accessibleAdministeredBank(): HasOne
    {
        return $this->administeredBank()->where('status', '!=', BankStatus::Deactivated);
    }

    /** @return HasMany<BankMembership, $this> */
    public function memberships(): HasMany
    {
        return $this->hasMany(BankMembership::class);
    }
}
