<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /** Bcrypt hash (cost 12, same as real passwords) of a random value nobody knows. */
    private const DUMMY_HASH = '$2y$12$KY4A21ZrHZZ4ITelrkUTS.Ij04JDzl9zMV2B7LEY4zI6MVL6QX2K6';

    /** @unauthenticated */
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'device_name' => ['nullable', 'string', 'max:100'],
        ]);

        $user = User::where('email', User::normalizeEmail($data['email']))->first();
        // Hash even for unknown emails so response time does not reveal which accounts exist.
        $passwordMatches = Hash::check($data['password'], $user?->password ?? self::DUMMY_HASH);

        if (! $user || ! $user->active || ! $passwordMatches) {
            throw ValidationException::withMessages(['email' => 'El email o la contraseña no son correctos.']);
        }

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
