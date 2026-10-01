<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

/** Bank detail for the superadmin: administrator and client list, still without financial data. */
class PlatformBankDetailResource extends PlatformBankResource
{
    public function toArray(Request $request): array
    {
        $data = parent::toArray($request);

        $data['admin']['last_seen_at'] = $this->admin?->last_seen_at;
        $data['clients'] = $this->memberships
            ->sortBy(fn ($membership) => mb_strtolower($membership->user->name))
            ->values()
            ->map(fn ($membership) => [
                'id' => $membership->id,
                'name' => $membership->user->name,
                'email' => $membership->user->email,
                'status' => $membership->status->value,
                'member_since' => $membership->created_at,
                'last_seen_at' => $membership->user->last_seen_at,
            ]);

        return $data;
    }
}
