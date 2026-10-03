<?php

namespace App\Http\Controllers\Admin;

use App\Exceptions\ExchangeRateUnavailableException;
use App\Http\Controllers\Controller;
use App\Services\BankReports;
use App\Services\ExchangeRates;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ReportController extends Controller
{
    public function __construct(private BankReports $reports) {}

    public function dashboard(Request $request, ExchangeRates $rates): JsonResponse
    {
        try {
            $quotes = $rates->latest();
        } catch (ExchangeRateUnavailableException) {
            $quotes = null;
        }

        return response()->json(['data' => $this->reports->dashboard($request->attributes->get('bank')) + ['exchange_rates' => $quotes]]);
    }

    public function expenses(Request $request): JsonResponse
    {
        $bank = $request->attributes->get('bank');
        $data = $request->validate(['month' => ['nullable', 'date_format:Y-m']]);

        return response()->json(['data' => $this->reports->monthlyExpenses($bank, $data['month'] ?? now($bank->timezone)->format('Y-m'))]);
    }

    /** The month's movements in detail, for the whole bank or one of its clients. */
    public function movements(Request $request): JsonResponse
    {
        $bank = $request->attributes->get('bank');
        $data = $request->validate([
            'month' => ['nullable', 'date_format:Y-m'],
            'membership_id' => ['nullable', 'integer', Rule::exists('bank_memberships', 'id')->where('bank_id', $bank->id)],
        ]);

        return response()->json(['data' => $this->reports->monthlyMovements(
            $bank,
            $data['month'] ?? now($bank->timezone)->format('Y-m'),
            isset($data['membership_id']) ? (int) $data['membership_id'] : null,
        )]);
    }
}
