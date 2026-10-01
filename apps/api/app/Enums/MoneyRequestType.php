<?php

namespace App\Enums;

enum MoneyRequestType: string
{
    case SavingsDeposit = 'savings_deposit';
    case SavingsWithdrawal = 'savings_withdrawal';
    case Expense = 'expense';

    /** The type decides whose money moves: the client's savings or the bank's funds. */
    public function fundingSource(): FundingSource
    {
        return $this === self::Expense ? FundingSource::BankFunds : FundingSource::ClientSavings;
    }

    /** Expenses must explain what the money is for. */
    public function requiresDescription(): bool
    {
        return $this === self::Expense;
    }
}
