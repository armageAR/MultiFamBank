<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
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
                $user->administeredBank()->exists() => 'admin',
                default => 'client',
            };

            return config("multifambank.urls.$app").'/restablecer-contrasena?'.http_build_query([
                'token' => $token,
                'email' => $user->email,
            ]);
        });

        RateLimiter::for('auth', function (Request $request) {
            return Limit::perMinute(10)->by(mb_strtolower((string) $request->input('email')).'|'.$request->ip());
        });
    }
}
