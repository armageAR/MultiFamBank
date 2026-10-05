<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\Turnstile;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /** Bcrypt hash (cost 12, same as real passwords) of a random value nobody knows. */
    private const DUMMY_HASH = '$2y$12$KY4A21ZrHZZ4ITelrkUTS.Ij04JDzl9zMV2B7LEY4zI6MVL6QX2K6';

    /** Failed sign-ins an email may have, from any IP, before it is locked for LOCKOUT_SECONDS. */
    private const MAX_FAILURES = 10;

    private const LOCKOUT_SECONDS = 15 * 60;

    /** Rate limiter key that counts an email's failed sign-ins. */
    public static function failuresKey(string $email): string
    {
        return 'login-failures|'.User::normalizeEmail($email);
    }

    /** @unauthenticated */
    public function login(Request $request, Turnstile $turnstile): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'device_name' => ['nullable', 'string', 'max:100'],
            // Cloudflare Turnstile token, when the check is on.
            'turnstile_token' => ['nullable', 'string'],
        ]);

        $turnstile->ensureHuman($request);

        $email = User::normalizeEmail($data['email']);
        // Counted only after the human check, so a bot cannot lock someone out without solving it.
        $failures = self::failuresKey($email);
        if (RateLimiter::tooManyAttempts($failures, self::MAX_FAILURES)) {
            throw new ThrottleRequestsException(
                'Hubo demasiados intentos fallidos con este email. Esperá unos minutos y volvé a probar, o restablecé la contraseña.',
                headers: ['Retry-After' => RateLimiter::availableIn($failures)],
            );
        }

        $user = User::where('email', $email)->first();
        // Hash even for unknown emails so response time does not reveal which accounts exist.
        $passwordMatches = Hash::check($data['password'], $user?->password ?? self::DUMMY_HASH);

        if (! $user || ! $user->active || ! $passwordMatches) {
            RateLimiter::hit($failures, self::LOCKOUT_SECONDS);

            throw ValidationException::withMessages(['email' => 'El email o la contraseña no son correctos.']);
        }

        RateLimiter::clear($failures);

        $user->forceFill(['last_login_at' => now(), 'last_seen_at' => now()])->save();

        return response()->json([
            'token' => $user->createToken($data['device_name'] ?? 'web')->plainTextToken,
            'user' => new UserResource($user),
        ]);
    }

    public function me(Request $request): UserResource
    {
        return new UserResource($request->user());
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(null, 204);
    }
}
