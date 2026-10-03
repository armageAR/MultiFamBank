<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;

class AccessRequest extends Model
{
    protected $fillable = ['name', 'email', 'ip', 'user_agent'];

    protected function casts(): array
    {
        return ['notified_at' => 'datetime', 'contacted_at' => 'datetime'];
    }

    protected function email(): Attribute
    {
        return Attribute::set(fn (string $value) => User::normalizeEmail($value));
    }
}
