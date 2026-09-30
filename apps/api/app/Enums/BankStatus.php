<?php

namespace App\Enums;

enum BankStatus: string
{
    case PendingConfiguration = 'pending_configuration';
    case Active = 'active';
    case Paused = 'paused';
    case Deactivated = 'deactivated';

    /** Whether new financial requests and confirmations are allowed. */
    public function allowsFinancialWrites(): bool
    {
        return $this === self::Active;
    }
}
