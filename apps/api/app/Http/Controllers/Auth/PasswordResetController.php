<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;

class PasswordResetController extends Controller
{
    /** @unauthenticated */
    public function forgot(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => ['required', 'email']]);

        Password::sendResetLink(['email' => User::normalizeEmail($data['email'])]);

        // Same answer whether or not the email exists.
        return response()->json(['message' => 'Si el email está registrado, te enviamos un link para restablecer la contraseña.']);
    }

    /** @unauthenticated */
    public function reset(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'confirmed', PasswordRule::min(8)],
        ]);

        $status = Password::reset(
            ['email' => User::normalizeEmail($data['email'])] + $data,
            function (User $user, string $password) {
                $user->forceFill(['password' => $password])->save();
                // Sign out every other session, and stop notifications to their devices.
                $user->tokens()->delete();
                $user->pushSubscriptions()->delete();
            },
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages(['token' => 'El link para restablecer la contraseña no es válido o venció.']);
        }

        return response()->json(['message' => 'Contraseña actualizada. Ya podés ingresar.']);
    }
}
