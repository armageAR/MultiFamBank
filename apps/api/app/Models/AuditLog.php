<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class AuditLog extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['bank_id', 'actor_user_id', 'action', 'subject_type', 'subject_id', 'old_values', 'new_values'];

    protected function casts(): array
    {
        return [
            'old_values' => 'array',
            'new_values' => 'array',
        ];
    }

    public static function record(string $action, ?Model $subject = null, ?int $bankId = null, ?array $old = null, ?array $new = null): self
    {
        return self::create([
            'bank_id' => $bankId,
            'actor_user_id' => auth()->id(),
            'action' => $action,
            'subject_type' => $subject?->getMorphClass(),
            'subject_id' => $subject?->getKey(),
            'old_values' => $old,
            'new_values' => $new,
        ]);
    }

    public function subject(): MorphTo
    {
        return $this->morphTo();
    }
}
