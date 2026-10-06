<?php

namespace App\Http\Resources;

use App\Models\MoneyRequest;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin MoneyRequest */
class MoneyRequestResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $client = $this->membership?->user;
        $recordedByAdmin = $client !== null && $this->created_by !== $client->id;

        return [
            'id' => $this->id,
            'type' => $this->type->value,
            'funding_source' => $this->type->fundingSource()->value,
            'status' => $this->status->value,
            'amount_ars' => (string) $this->amount_ars,
            'exchange_rate' => $this->exchange_rate === null ? null : (string) $this->exchange_rate,
            'amount_usd' => $this->amount_usd === null ? null : (string) $this->amount_usd,
            'description' => $this->description,
            'occurred_at' => $this->occurred_at,
            'created_at' => $this->created_at,
            'confirmed_at' => $this->confirmed_at,
            'rejected_at' => $this->rejected_at,
            'rejection_reason' => $this->rejection_reason,
            'canceled_at' => $this->canceled_at,
            // What the client originally asked for, so changes made by the administrator are visible.
            'requested' => [
                'type' => $this->requested_type->value,
                'amount_ars' => (string) $this->requested_amount_ars,
                'description' => $this->requested_description,
            ],
            // Only a client's request has an original to compare with; a correction of an operation the
            // administrator recorded is not "a change to what was asked".
            'changed_by_admin' => ! $recordedByAdmin && (
                $this->requested_type !== $this->type
                || bccomp((string) $this->requested_amount_ars, (string) $this->amount_ars, 2) !== 0
                || $this->requested_description !== $this->description
            ),
            'recorded_by_admin' => $recordedByAdmin,
            'client' => $client ? [
                'membership_id' => $this->bank_membership_id,
                'name' => $client->name,
            ] : null,
        ];
    }
}
