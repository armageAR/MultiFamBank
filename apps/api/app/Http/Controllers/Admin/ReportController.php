<?php

namespace App\Http\Controllers\Admin;

use App\Exceptions\ExchangeRateUnavailableException;
use App\Http\Controllers\Controller;
use App\Services\BankReports;
use App\Services\ExchangeRates;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
}
