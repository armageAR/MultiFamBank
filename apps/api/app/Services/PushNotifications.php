<?php

namespace App\Services;

use App\Models\PushSubscription;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;
use Throwable;

/** Web Push delivery, ported from FamBank: high urgency, kept by the push service for a day. */
class PushNotifications
{
    /** Browser push services. Only these endpoints are stored, so the server never calls arbitrary URLs. */
    private const PUSH_HOSTS = [
        'fcm.googleapis.com',
        'updates.push.services.mozilla.com',
        'web.push.apple.com',
    ];

    private const PUSH_HOST_SUFFIXES = ['.push.services.mozilla.com', '.notify.windows.com', '.push.apple.com'];

    public static function isKnownPushService(string $endpoint): bool
    {
        $parts = parse_url($endpoint);

        if (($parts['scheme'] ?? null) !== 'https' || isset($parts['port']) || ! isset($parts['host'])) {
            return false;
        }

        $host = strtolower($parts['host']);

        return in_array($host, self::PUSH_HOSTS, true)
            || collect(self::PUSH_HOST_SUFFIXES)->contains(fn ($suffix) => str_ends_with($host, $suffix));
    }

    /** Signing out of everywhere (password or email change) also stops this person's notifications. */
    public function forget(User $user): void
    {
        $user->pushSubscriptions()->delete();
    }

    public function configured(): bool
    {
        return filled(config('services.webpush.public_key')) && filled(config('services.webpush.private_key'));
    }

    /**
     * @param  array{title: string, body: string, url?: string, tag?: string}  $message
     * @return array{sent: int, failed: int, expired: int, errors: list<string>}
     */
    public function send(User $user, array $message): array
    {
        $result = ['sent' => 0, 'failed' => 0, 'expired' => 0, 'errors' => []];
        $subscriptions = $user->pushSubscriptions()->get();

        if ($subscriptions->isEmpty() || ! $this->configured()) {
            return $result;
        }

        $webPush = new WebPush(
            ['VAPID' => [
                'subject' => config('services.webpush.subject'),
                'publicKey' => config('services.webpush.public_key'),
                'privateKey' => config('services.webpush.private_key'),
            ]],
            ['TTL' => 86400, 'urgency' => 'high'],
        );

        foreach ($subscriptions as $subscription) {
            if (! self::isKnownPushService($subscription->endpoint)) {
                continue;
            }

            $webPush->queueNotification(
                Subscription::create([
                    'endpoint' => $subscription->endpoint,
                    'publicKey' => $subscription->public_key,
                    'authToken' => $subscription->auth_token,
                    'contentEncoding' => $subscription->content_encoding,
                ]),
                json_encode($message, JSON_UNESCAPED_UNICODE),
            );
        }

        foreach ($webPush->flush() as $report) {
            if ($report->isSuccess()) {
                $result['sent']++;

                continue;
            }

            $result['failed']++;
            $result['errors'][] = $report->getReason();
            Log::warning('Push delivery failed', ['user_id' => $user->id, 'reason' => $report->getReason()]);

            // The browser dropped the subscription: forget it.
            if ($report->isSubscriptionExpired()) {
                $result['expired']++;
                PushSubscription::where('endpoint_hash', hash('sha256', $report->getEndpoint()))->delete();
            }
        }

        return $result;
    }

    /** Same as send(), but never throws: notifications must not break the operation that caused them. */
    public function sendQuietly(User $user, array $message): void
    {
        try {
            $this->send($user, $message);
        } catch (Throwable $e) {
            Log::warning('Push notification failed', ['user_id' => $user->id, 'error' => $e->getMessage()]);
        }
    }
}
