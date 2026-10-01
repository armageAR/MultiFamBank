<?php

namespace App\Http\Controllers\Client;

use App\Enums\BankStatus;
use App\Enums\MembershipStatus;
use App\Http\Controllers\Controller;
use App\Models\BankMembership;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BankController extends Controller
{
    /** The banks this person is a client of (deactivated banks are not listed). */
    public function index(Request $request): JsonResponse
    {
        $memberships = BankMembership::with(['bank', 'savingsAccount'])
            ->where('user_id', $request->user()->id)
            ->where('status', MembershipStatus::Active)
            ->whereHas('bank', fn ($query) => $query->where('status', '!=', BankStatus::Deactivated))
            ->get();

        return response()->json(['data' => $memberships->map(fn ($m) => $this->present($m))->values()]);
    }

    public function show(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->present($request->attributes->get('membership')->load(['bank', 'savingsAccount']))]);
    }

    private function present(BankMembership $membership): array
    {
        $account = $membership->savingsAccount;

        return [
            'bank' => ['id' => $membership->bank->id, 'name' => $membership->bank->name, 'status' => $membership->bank->status->value],
            'balance_usd' => (string) ($account?->balance_usd ?? '0.00'),
            'reserved_usd' => (string) ($account?->reserved_usd ?? '0.00'),
            'available_usd' => $account ? $account->availableUsd() : '0.00',
        ];
    }
}
