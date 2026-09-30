<?php

namespace App\Enums;

enum LedgerEntryKind: string
{
    case SavingsCredit = 'savings_credit';
    case SavingsDebit = 'savings_debit';
    case BankExpense = 'bank_expense';
}
