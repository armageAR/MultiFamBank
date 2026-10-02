<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** A bank as seen by the platform superadmin: lifecycle and administrator, no financial data. */
class PlatformBankResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $invitation = $this->adminInvitation;

        return [
            'id' => $this->id,
            'name' => $this->name,
            'status' => $this->status->value,
            'timezone' => $this->timezone,
            'admin' => [
                'email' => $this->admin?->email ?? $this->admin_email,
                'name' => $this->admin?->name ?? $invitation?->name,
                'accepted' => $this->admin_user_id !== null,
            ],
            'invitation' => $invitation ? [
                'state' => $invitation->state(),
                'expires_at' => $invitation->expires_at,
                'last_sent_at' => $invitation->last_sent_at,
                'accepted_at' => $invitation->accepted_at,
                'resend_available_at' => $invitation->resendAvailableAt(),
            ] : null,
            'created_at' => $this->created_at,
            'activated_at' => $this->activated_at,
            'paused_at' => $this->paused_at,
            'deactivated_at' => $this->deactivated_at,
        ];
    }
}
