<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin User */
class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $bank = $this->accessibleAdministeredBank;

        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'is_superadmin' => $this->is_superadmin,
            'administered_bank' => $bank ? [
                'id' => $bank->id,
                'name' => $bank->name,
                'status' => $bank->status->value,
            ] : null,
        ];
    }
}
