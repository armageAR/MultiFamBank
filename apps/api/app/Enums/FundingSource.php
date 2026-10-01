<?php

namespace App\Enums;

/** Derived from MoneyRequestType; not stored. */
enum FundingSource: string
{
    case ClientSavings = 'client_savings';
    case BankFunds = 'bank_funds';
}
