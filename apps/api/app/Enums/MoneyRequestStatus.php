<?php

namespace App\Enums;

enum MoneyRequestStatus: string
{
    case Pending = 'pending';
    case Confirmed = 'confirmed';
    case Rejected = 'rejected';
    case Canceled = 'canceled';
}
