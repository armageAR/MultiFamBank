<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * A person changes their own email or password, confirming with the current password (as in
 * FamBank's "Mi cuenta"). The name is managed by whoever administers them.
 */
class ProfileController extends Controller
{
    public function update(Request $request): UserResource
    {
        $user = $request->user();
        $data = $request->validate([
            'current_password' => ['required', 'string', 'current_password:sanctum'],
            'email' => ['sometimes', 'required', 'email:rfc', 'max:255'],
            'password' => ['sometimes', 'required', 'confirmed', Password::min(8)],
        ]);

        $email = isset($data['email']) ? User::normalizeEmail($data['email']) : $user->email;

        if ($email !== $user->email && User::where('email', $email)->whereKeyNot($user->id)->exists()) {
            throw ValidationException::withMessages(['email' => 'Ya existe otra cuenta con ese email.']);
        }

        try {
            DB::transaction(function () use ($user, $data, $email, $request) {
                $before = ['email' => $user->email];
                $emailChanged = $email !== $user->email;

                $user->email = $email;
                if ($emailChanged) {
                    $user->email_verified_at = null;
                }
                if (isset($data['password'])) {
                    $user->password = $data['password'];
                }
                $user->save();

                if ($emailChanged || isset($data['password'])) {
                    // Other sessions sign out; this one stays. Notifications stop on every device;
                    // this device re-registers its subscription the next time the app opens.
                    $current = $request->user()->currentAccessToken();
                    $user->tokens()->when($current instanceof PersonalAccessToken, fn ($q) => $q->whereKeyNot($current->id))->delete();
                    $user->pushSubscriptions()->delete();
                }

                AuditLog::record('profile.updated', $user, null, $before, [
                    'email' => $user->email,
                    'password_changed' => isset($data['password']),
                ]);
            });
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages(['email' => 'Ese email ya está en uso.']);
        }

        return new UserResource($user->fresh());
    }
}
