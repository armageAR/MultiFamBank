<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Cloudflare Turnstile: confirms that a public form was sent by a person. Without a secret key
 * (local development, tests) the check is off.
 */
class Turnstile
{
    private const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

    public function enabled(): bool
    {
        return filled(config('multifambank.turnstile.secret_key'));
    }

    /** Each token is valid once; an unreachable Cloudflare counts as not verified. */
    public function verify(?string $token, ?string $ip): bool
    {
        if (! $this->enabled()) {
            // Visible in the logs: a production form that looks protected but is not.
            if (app()->isProduction()) {
                Log::warning('Turnstile is off: TURNSTILE_SECRET_KEY is not set');
            }

            return true;
        }

        if (blank($token) || strlen($token) > 2048) {
            return false;
        }

        try {
            $response = Http::timeout(5)->asForm()->post(self::VERIFY_URL, array_filter([
                'secret' => config('multifambank.turnstile.secret_key'),
                'response' => $token,
                'remoteip' => $ip,
            ]));

            if ($response->json('success') === true) {
                return true;
            }

            Log::info('Turnstile rejected a form', ['errors' => $response->json('error-codes')]);
        } catch (Throwable $e) {
            Log::warning('Turnstile verification failed', ['error' => $e->getMessage()]);
        }

        return false;
    }
}
