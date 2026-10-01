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
    public function configured(): bool
    {
        return filled(config('services.webpush.public_key')) && filled(config('services.webpush.private_key'));
    }

    /**
     * @param  array{title: string, body: string, url?: string, tag?: string}  $message
     * @return array{sent: int, failed: int, errors: list<string>}
     */
    public function send(User $user, array $message): array
    {
        $result = ['sent' => 0, 'failed' => 0, 'errors' => []];
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

            // The browser dropped the subscription: forget it.
            if ($report->isSubscriptionExpired()) {
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
