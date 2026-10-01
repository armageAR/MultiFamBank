<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Stores when a user last used the API; writes at most once per interval per user. */
class RecordLastSeen
{
    private const INTERVAL_MINUTES = 5;

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        // Checked after the route ran, so auth:sanctum has already resolved the user.
        $user = $request->user();

        if ($user && ($user->last_seen_at === null || $user->last_seen_at->lt(now()->subMinutes(self::INTERVAL_MINUTES)))) {
            $user->forceFill(['last_seen_at' => now()])->saveQuietly();
        }

        return $response;
    }
}
