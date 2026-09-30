<?php

namespace App\Enums;

enum FundingSource: string
{
    case ClientSavings = 'client_savings';
    case BankFunds = 'bank_funds';
}
