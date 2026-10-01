<?php

namespace App\Http\Controllers;

use App\Models\PushSubscription;
use App\Services\PushNotifications;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PushSubscriptionController extends Controller
{
    /** @unauthenticated */
    public function publicKey(PushNotifications $push): JsonResponse
    {
        return response()->json(['key' => $push->configured() ? config('services.webpush.public_key') : null]);
    }

    /** Registers this browser; the endpoint identifies it, so re-subscribing updates the same row. */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'endpoint' => ['required', 'url', 'max:2048'],
            'keys.p256dh' => ['required', 'string', 'max:255'],
            'keys.auth' => ['required', 'string', 'max:255'],
        ]);

        PushSubscription::updateOrCreate(
            ['endpoint_hash' => hash('sha256', $data['endpoint'])],
            [
                'user_id' => $request->user()->id,
                'endpoint' => $data['endpoint'],
                'public_key' => $data['keys']['p256dh'],
                'auth_token' => $data['keys']['auth'],
                'content_encoding' => 'aes128gcm',
            ],
        );

        return response()->json(['message' => 'Notificaciones activadas.']);
    }

    public function destroy(Request $request): JsonResponse
    {
        $data = $request->validate(['endpoint' => ['required', 'string']]);

        PushSubscription::where('user_id', $request->user()->id)
            ->where('endpoint_hash', hash('sha256', $data['endpoint']))->delete();

        return response()->json(null, 204);
    }

    /** As in FamBank: send a test notification and explain exactly what failed. */
    public function test(Request $request, PushNotifications $push): JsonResponse
    {
        if (! $push->configured()) {
            return response()->json(['message' => 'Las notificaciones no están configuradas en el servidor.'], 503);
        }

        $result = $push->send($request->user(), [
            'title' => 'Notificación de prueba',
            'body' => 'Si ves esto, las notificaciones funcionan correctamente.',
            'tag' => 'test',
        ]);

        if ($result['sent'] === 0) {
            return response()->json([
                'message' => $result['failed'] > 0
                    ? 'El servicio de notificaciones rechazó el envío: '.implode(' · ', array_unique($result['errors']))
                    : 'No hay ningún dispositivo registrado para tu usuario. Volvé a activar las notificaciones.',
                'data' => $result,
            ], 422);
        }

        return response()->json(['message' => 'Notificación enviada.', 'data' => $result]);
    }
}
