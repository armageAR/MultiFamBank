<?php

namespace App\Http\Controllers\Admin;

use App\Enums\MoneyRequestType;
use Illuminate\Validation\Rule;

/** Validation shared by client requests and administrator edits. */
final class OperationRules
{
    public static function amount(): array
    {
        return ['numeric', 'decimal:0,2', 'min:0.01', 'max:999999999999.99'];
    }

    public static function rate(): array
    {
        return ['numeric', 'decimal:0,4', 'gt:0', 'max:99999999.9999'];
    }

    public static function date(): array
    {
        return ['date', 'before_or_equal:'.now()->addDay()->toIso8601String()];
    }

    public static function create(bool $withRate = false): array
    {
        return [
            'type' => ['required', Rule::enum(MoneyRequestType::class)],
            'amount_ars' => ['required', ...self::amount()],
            'description' => ['nullable', 'string', 'max:255', Rule::requiredIf(fn () => request('type') === MoneyRequestType::Expense->value)],
        ] + ($withRate ? [
            'exchange_rate' => ['nullable', 'required_unless:type,'.MoneyRequestType::Expense->value, ...self::rate()],
            'occurred_at' => ['nullable', ...self::date()],
        ] : []);
    }

    public static function edit(): array
    {
        return [
            'type' => ['sometimes', Rule::enum(MoneyRequestType::class)],
            'amount_ars' => ['sometimes', ...self::amount()],
            'description' => ['sometimes', 'nullable', 'string', 'max:255'],
            'occurred_at' => ['sometimes', 'nullable', ...self::date()],
            'exchange_rate' => ['sometimes', 'nullable', ...self::rate()],
        ];
    }
}
