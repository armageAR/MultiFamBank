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
        // Only administrators may force a fresh quote; everyone shares the cached one.
        if ($request->boolean('refresh') && ($request->user()->is_superadmin || $request->user()->accessibleAdministeredBank()->exists())) {
            $rates->forget();
        }

        try {
            return response()->json(['data' => $rates->latest()]);
        } catch (ExchangeRateUnavailableException $e) {
            return response()->json(['message' => $e->getMessage()], 503);
        }
    }
}
