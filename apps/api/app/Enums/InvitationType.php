<?php

namespace App\Enums;

enum InvitationType: string
{
    case BankAdmin = 'bank_admin';
    case BankClient = 'bank_client';
}
