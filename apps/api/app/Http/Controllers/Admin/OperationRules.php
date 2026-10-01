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

    /** Pesos per dollar. Below 1 is surely a typo (e.g. "1" instead of "1000"). */
    public static function rate(): array
    {
        return ['numeric', 'decimal:0,4', 'min:1', 'max:1000000'];
    }

    /**
     * A full timestamp with its offset ("2026-09-15T12:00:00.000Z"). A bare date would be read in
     * UTC and could land on the previous day, and month, in the bank's timezone.
     */
    public static function date(): array
    {
        return [
            'regex:/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/',
            'date',
            'after_or_equal:2000-01-01',
            'before_or_equal:'.now()->addDay()->toIso8601String(),
        ];
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
