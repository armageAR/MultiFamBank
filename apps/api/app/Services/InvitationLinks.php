<?php

namespace App\Services;

use App\Enums\InvitationType;
use App\Models\Invitation;

class InvitationLinks
{
    public static function acceptUrl(Invitation $invitation, string $plainToken): string
    {
        $app = $invitation->type === InvitationType::BankAdmin ? 'admin' : 'client';

        return config("multifambank.urls.$app").'/invitacion/'.$plainToken;
    }
}
