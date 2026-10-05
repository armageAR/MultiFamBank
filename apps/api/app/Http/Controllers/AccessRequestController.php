<?php

namespace App\Http\Controllers;

use App\Mail\AccessRequestReceivedMail;
use App\Models\AccessRequest;
use App\Models\User;
use App\Services\Turnstile;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

/** Public form of the landing page: stores the request and emails the owner, once per email. */
class AccessRequestController extends Controller
{
    private const DUPLICATE = 'Ya tenemos una solicitud con este email. Te vamos a contactar pronto.';

    public function store(Request $request, Turnstile $turnstile): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email:rfc', 'max:255'],
            // Honeypot: hidden from people, filled by bots.
            'website' => ['nullable', 'string', 'max:0'],
            // Cloudflare Turnstile token, when the check is on.
            'turnstile_token' => ['nullable', 'string'],
        ], [
            'name.required' => 'Contanos tu nombre.',
            'email.required' => 'Necesitamos tu email para contactarte.',
            'email.email' => 'Ese email no parece válido.',
            'website.max' => 'No se pudo enviar la solicitud.',
        ]);

        // Before looking the email up, so the form cannot be used to probe which emails asked.
        if (! $turnstile->verify($data['turnstile_token'] ?? null, $request->ip())) {
            throw ValidationException::withMessages(['turnstile_token' => 'No pudimos confirmar que seas una persona. Probá de nuevo.']);
        }

        $email = User::normalizeEmail($data['email']);
        if (AccessRequest::where('email', $email)->exists()) {
            throw ValidationException::withMessages(['email' => self::DUPLICATE]);
        }

        try {
            $accessRequest = AccessRequest::create([
                'name' => trim($data['name']),
                'email' => $email,
                'ip' => $request->ip(),
                'user_agent' => Str::limit((string) $request->userAgent(), 250, ''),
            ]);
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages(['email' => self::DUPLICATE]);
        }

        // The request is kept even if the email cannot be sent; notified_at shows which were.
        $recipient = config('multifambank.access_requests.notify_to');
        if ($recipient) {
            try {
                $mailer = (string) config('multifambank.access_requests.mailer');
                Mail::mailer($mailer)->to($recipient)->send(new AccessRequestReceivedMail($accessRequest));
                // The log and array mailers deliver nothing: those requests stay marked as not notified.
                if (in_array(config("mail.mailers.$mailer.transport"), ['log', 'array'], true)) {
                    Log::warning('Access request stored but not emailed: the mailer does not deliver', ['access_request_id' => $accessRequest->id, 'mailer' => $mailer]);
                } else {
                    $accessRequest->forceFill(['notified_at' => now()])->save();
                }
            } catch (Throwable $e) {
                Log::error('Access request notification failed', ['access_request_id' => $accessRequest->id, 'error' => $e->getMessage()]);
            }
        }

        return response()->json(['data' => ['name' => $accessRequest->name, 'email' => $accessRequest->email]], 201);
    }
}
