<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\BankSetup;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class BankSetupController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->present($request->attributes->get('bank'))]);
    }

    public function update(Request $request, BankSetup $setup): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'timezone' => ['required', Rule::in(timezone_identifiers_list())],
        ]);

        $bank = $setup->update($request->attributes->get('bank'), $data['name'], $data['timezone']);

        return response()->json(['data' => $this->present($bank)]);
    }

    private function present($bank): array
    {
        return [
            'id' => $bank->id,
            'name' => $bank->name,
            'timezone' => $bank->timezone,
            'status' => $bank->status->value,
            'activated_at' => $bank->activated_at,
        ];
    }
}
