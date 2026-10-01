<?php

namespace App\Http\Controllers;

use App\Exceptions\ExchangeRateUnavailableException;
use App\Services\ExchangeRates;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ExchangeRateController extends Controller
{
    public function show(Request $request, ExchangeRates $rates): JsonResponse
    {
        if ($request->boolean('refresh')) {
            $rates->forget();
        }

        try {
            return response()->json(['data' => $rates->latest()]);
        } catch (ExchangeRateUnavailableException $e) {
            return response()->json(['message' => $e->getMessage()], 503);
        }
    }
}
