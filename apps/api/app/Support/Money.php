<?php

namespace App\Support;

/** Decimal-safe money arithmetic on strings (bcmath), ported from the original FamBank. */
final class Money
{
    private const DIV_SCALE = 6;

    /** ARS converted to USD at a rate of ARS per USD, rounded half-up to cents. */
    public static function arsToUsd(string|int $ars, string|int $rate): string
    {
        return self::round(bcdiv((string) $ars, (string) $rate, self::DIV_SCALE));
    }

    /** Half-up rounding to two decimals for non-negative amounts. */
    public static function round(string $amount): string
    {
        return bcadd($amount, '0.005', 2);
    }

    public static function add(string $a, string $b): string
    {
        return bcadd($a, $b, 2);
    }

    public static function sub(string $a, string $b): string
    {
        return bcsub($a, $b, 2);
    }

    public static function greaterThan(string $a, string $b): bool
    {
        return bccomp($a, $b, 2) === 1;
    }
}
