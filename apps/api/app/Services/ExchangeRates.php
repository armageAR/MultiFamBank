<?php

namespace App\Services;

use App\Exceptions\ExchangeRateUnavailableException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/** Blue and official USD quotes from Bluelytics, cached for five minutes (as in FamBank). */
class ExchangeRates
{
    private const API_URL = 'https://api.bluelytics.com.ar/v2/latest';

    private const CACHE_KEY = 'exchange_rates.latest';

    private const CACHE_SECONDS = 300;

    private const LAST_GOOD_KEY = 'exchange_rates.last_good';

    private const FAILURE_KEY = 'exchange_rates.failing';

    /**
     * @return array{blue: array{buy: string, sell: string}, oficial: array{buy: string, sell: string}, fetched_at: string}
     *
     * @throws ExchangeRateUnavailableException
     */
    public function latest(): array
    {
        try {
            if (Cache::has(self::FAILURE_KEY)) {
                throw new ExchangeRateUnavailableException('No se pudo obtener la cotización del dólar en este momento. Volvé a intentarlo en unos minutos.');
            }

            return Cache::remember(self::CACHE_KEY, self::CACHE_SECONDS, function () {
                $rates = $this->fetch();
                Cache::forever(self::LAST_GOOD_KEY, $rates);

                return $rates;
            });
        } catch (ExchangeRateUnavailableException $e) {
            // Avoid waiting on a down service for every request.
            Cache::add(self::FAILURE_KEY, true, 30);

            // Bluelytics is down: a quote from the last day is better than blocking every request.
            $lastGood = Cache::get(self::LAST_GOOD_KEY);

            if ($lastGood && Carbon::parse($lastGood['fetched_at'])->gt(now()->subDay())) {
                return $lastGood;
            }

            throw $e;
        }
    }

    /**
     * Rate a client request starts from: deposits use the blue sell price (the bank sells
     * dollars), withdrawals the blue buy price (the bank buys them).
     */
    public function forClientRequest(bool $isDeposit): string
    {
        $blue = $this->latest()['blue'];

        return $isDeposit ? $blue['sell'] : $blue['buy'];
    }

    public function forget(): void
    {
        Cache::forget(self::CACHE_KEY);
        Cache::forget(self::FAILURE_KEY);
    }

    private function fetch(): array
    {
        try {
            $response = Http::timeout(5)->acceptJson()->get(self::API_URL);
            $response->throw();

            $rate = fn (string $type) => [
                'buy' => number_format((float) $response->json("$type.value_buy"), 2, '.', ''),
                'sell' => number_format((float) $response->json("$type.value_sell"), 2, '.', ''),
            ];

            foreach (['blue.value_buy', 'blue.value_sell', 'oficial.value_buy', 'oficial.value_sell'] as $field) {
                if (! is_numeric($response->json($field)) || $response->json($field) <= 0) {
                    throw new ExchangeRateUnavailableException("Cotización inválida: $field.");
                }
            }

            return [
                'blue' => $rate('blue'),
                'oficial' => $rate('oficial'),
                'fetched_at' => Carbon::parse($response->json('last_update') ?? now())->toIso8601String(),
            ];
        } catch (Throwable $e) {
            Log::warning('Exchange rates unavailable', ['error' => $e->getMessage()]);

            throw new ExchangeRateUnavailableException('No se pudo obtener la cotización del dólar en este momento. Volvé a intentarlo en unos minutos.', previous: $e);
        }
    }
}
