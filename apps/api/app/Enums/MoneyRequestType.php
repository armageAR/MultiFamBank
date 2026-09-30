<?php

namespace App\Enums;

enum MoneyRequestType: string
{
    case SavingsDeposit = 'savings_deposit';
    case SavingsWithdrawal = 'savings_withdrawal';
    case Expense = 'expense';
}
