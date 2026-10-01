<?php

namespace App\Http\Controllers;

use App\Enums\InvitationType;
use App\Http\Resources\UserResource;
use App\Models\Invitation;
use App\Models\User;
use App\Services\InvitationAcceptance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rules\Password;

class InvitationController extends Controller
{
    /**
     * Invitation details needed to render the acceptance page.
     *
     * @unauthenticated
     */
    public function show(string $token): JsonResponse
    {
        $invitation = Invitation::findByToken($token);
        abort_unless($invitation !== null, 404, 'La invitación no existe.');

        return response()->json([
            'type' => $invitation->type->value,
            'state' => $invitation->state(),
            'email' => $invitation->email,
            'name' => $invitation->name,
            'expires_at' => $invitation->expires_at,
            'bank' => [
                'name' => $invitation->bank->name,
                'status' => $invitation->bank->status->value,
            ],
            // Existing identities sign in with their current password instead of registering.
            'has_account' => User::where('email', $invitation->email)->exists(),
        ]);
    }

    /** @unauthenticated */
    public function accept(Request $request, string $token, InvitationAcceptance $acceptance): JsonResponse
    {
        $invitation = Invitation::findByToken($token);
        abort_unless($invitation !== null, 404, 'La invitación no existe.');

        $isNewUser = ! User::where('email', $invitation->email)->exists();

        $data = $request->validate($isNewUser ? [
            'name' => ['required', 'string', 'max:120'],
            'password' => ['required', 'confirmed', Password::min(8)],
        ] : [
            'password' => ['required', 'string'],
        ]);

        $user = $acceptance->accept($token, $data);
        $user->forceFill(['last_login_at' => now(), 'last_seen_at' => now()])->save();
        $app = $invitation->type === InvitationType::BankAdmin ? 'admin' : 'client';

        return response()->json([
            'token' => $user->createToken($app)->plainTextToken,
            'user' => new UserResource($user->fresh()),
        ]);
    }
}
