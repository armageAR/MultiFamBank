<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Mail\Markdown;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Reset links open the frontend that matches the user's role, not the API.
        ResetPassword::createUrlUsing(function (User $user, string $token): string {
            $app = match (true) {
                $user->is_superadmin => 'superadmin',
                $user->accessibleAdministeredBank()->exists() => 'admin',
                default => 'client',
            };

            return config("multifambank.urls.$app").'/restablecer-contrasena?'.http_build_query([
                'token' => $token,
                'email' => $user->email,
            ]);
        });

        // Names and other user input in Markdown emails stay text, never links or formatting.
        Markdown::withSecuredEncoding();

        RateLimiter::for('access-requests', function (Request $request) {
            return [Limit::perMinute(5)->by($request->ip()), Limit::perDay(20)->by($request->ip())];
        });

        // Per email and IP, plus a cap per IP so one address cannot try many accounts.
        RateLimiter::for('auth', function (Request $request) {
            return [
                Limit::perMinute(10)->by(mb_strtolower((string) $request->input('email')).'|'.$request->ip()),
                Limit::perMinute(30)->by('ip|'.$request->ip()),
            ];
        });
    }
}
