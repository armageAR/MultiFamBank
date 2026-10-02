<?php

namespace App\Models;

use App\Enums\InvitationType;
use App\Exceptions\DomainRuleException;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class Invitation extends Model
{
    /** A new link for the same person can be sent at most this often, so emails don't pile up. */
    public const RESEND_COOLDOWN_MINUTES = 5;

    protected $fillable = [
        'type',
        'bank_id',
        'email',
        'name',
        'token_hash',
        'invited_by',
        'expires_at',
        'accepted_at',
        'accepted_by',
        'revoked_at',
        'last_sent_at',
        'send_count',
    ];

    protected function casts(): array
    {
        return [
            'type' => InvitationType::class,
            'expires_at' => 'datetime',
            'accepted_at' => 'datetime',
            'revoked_at' => 'datetime',
            'last_sent_at' => 'datetime',
        ];
    }

    public static function newToken(): string
    {
        return Str::random(64);
    }

    public static function hashToken(string $token): string
    {
        return hash('sha256', $token);
    }

    public static function findByToken(string $token): ?self
    {
        return self::where('token_hash', self::hashToken($token))->first();
    }

    /** pending | accepted | expired | revoked */
    public function state(): string
    {
        return match (true) {
            $this->accepted_at !== null => 'accepted',
            $this->revoked_at !== null => 'revoked',
            $this->expires_at->isPast() => 'expired',
            default => 'pending',
        };
    }

    /** When another invitation to the same person may be sent. */
    public function resendAvailableAt(): Carbon
    {
        return $this->created_at->copy()->addMinutes(self::RESEND_COOLDOWN_MINUTES);
    }

    /** @throws DomainRuleException while the previous invitation is too recent. */
    public function assertResendAllowed(): void
    {
        if ($this->accepted_at === null && $this->revoked_at === null && $this->resendAvailableAt()->isFuture()) {
            $minutes = (int) ceil(now()->diffInSeconds($this->resendAvailableAt()) / 60);

            throw new DomainRuleException('invitation', "Ya se envió una invitación hace muy poco. Podés reenviarla en {$minutes} ".($minutes === 1 ? 'minuto' : 'minutos').'.');
        }
    }

    public function isAcceptable(): bool
    {
        return $this->state() === 'pending';
    }

    public function scopeOfType(Builder $query, InvitationType $type): void
    {
        $query->where('type', $type);
    }

    public function bank(): BelongsTo
    {
        return $this->belongsTo(Bank::class);
    }

    public function inviter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'invited_by');
    }
}
