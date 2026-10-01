<?php

namespace Tests\Feature;

use App\Enums\BankStatus;
use App\Models\Bank;
use App\Models\PushSubscription;
use App\Models\User;
use App\Services\PushNotifications;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Password;
use Laravel\Sanctum\Sanctum;
use Mockery;
use Tests\TestCase;

class PushNotificationsTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_browser_subscription_is_stored_once_per_endpoint(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $subscription = ['endpoint' => 'https://fcm.googleapis.com/fcm/send/abc', 'keys' => ['p256dh' => 'key', 'auth' => 'auth']];

        $this->postJson('/api/push/subscriptions', $subscription)->assertOk();
        $this->postJson('/api/push/subscriptions', $subscription)->assertOk();
        $this->assertSame(1, PushSubscription::count());

        $this->deleteJson('/api/push/subscriptions', ['endpoint' => 'https://fcm.googleapis.com/fcm/send/abc'])->assertNoContent();
        $this->assertSame(0, PushSubscription::count());
    }

    public function test_the_public_key_is_exposed_only_when_configured(): void
    {
        config(['services.webpush.public_key' => null, 'services.webpush.private_key' => null]);
        $this->getJson('/api/push/public-key')->assertJsonPath('key', null);

        config(['services.webpush.public_key' => 'PUBLIC', 'services.webpush.private_key' => 'PRIVATE']);
        $this->getJson('/api/push/public-key')->assertJsonPath('key', 'PUBLIC');
    }

    public function test_the_test_endpoint_explains_missing_devices(): void
    {
        config(['services.webpush.public_key' => 'PUBLIC', 'services.webpush.private_key' => 'PRIVATE']);
        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/push/test')->assertStatus(422)->assertJsonPath('data.sent', 0);
    }

    public function test_requests_notify_the_admin_and_resolutions_notify_the_client(): void
    {
        Http::fake(['api.bluelytics.com.ar/*' => Http::response([
            'blue' => ['value_buy' => 1000, 'value_sell' => 1100], 'oficial' => ['value_buy' => 900, 'value_sell' => 950],
        ])]);
        $admin = User::factory()->create(['name' => 'Admin']);
        $client = User::factory()->create(['name' => 'Sofía']);
        $bank = Bank::create(['name' => 'Familia', 'admin_email' => $admin->email, 'admin_user_id' => $admin->id, 'status' => BankStatus::Active]);
        $membership = $bank->memberships()->create(['user_id' => $client->id]);
        $membership->savingsAccount()->create(['bank_id' => $bank->id, 'balance_usd' => '100']);

        $sent = [];
        $push = Mockery::mock(PushNotifications::class);
        $push->shouldReceive('sendQuietly')->andReturnUsing(function (User $user, array $message) use (&$sent) {
            $sent[] = [$user->id, $message['title'], $message['body']];
        });
        $this->app->instance(PushNotifications::class, $push);

        Sanctum::actingAs($client);
        $id = $this->postJson("/api/client/banks/{$bank->id}/operations", ['type' => 'expense', 'amount_ars' => '15000', 'description' => 'Salida'])->json('data.id');
        Sanctum::actingAs($admin);
        $this->postJson("/api/admin/operations/$id/confirm", ['amount_ars' => '12000'])->assertOk();

        $this->assertSame([$admin->id, 'Nuevo pedido', 'Sofía pide un gasto de $ 15.000: Salida'], $sent[0]);
        $this->assertSame([$client->id, 'Pedido confirmado', 'Se confirmó un gasto de $ 12.000 (con cambios del administrador).'], $sent[1]);
    }

    public function test_only_known_push_services_can_be_registered(): void
    {
        Sanctum::actingAs(User::factory()->create());

        foreach (['http://169.254.169.254/latest', 'https://localhost:5432/x', 'https://evil.example.com/push', 'http://fcm.googleapis.com/x'] as $endpoint) {
            $this->postJson('/api/push/subscriptions', ['endpoint' => $endpoint, 'keys' => ['p256dh' => 'k', 'auth' => 'a']])
                ->assertJsonValidationErrors('endpoint');
        }

        $this->postJson('/api/push/subscriptions', ['endpoint' => 'https://web.push.apple.com/abc', 'keys' => ['p256dh' => 'k', 'auth' => 'a']])->assertOk();
        $this->postJson('/api/push/subscriptions', ['endpoint' => 'https://wns2-par02p.notify.windows.com/w/?token=x', 'keys' => ['p256dh' => 'k', 'auth' => 'a']])->assertOk();
    }

    public function test_resetting_the_password_stops_notifications_to_old_devices(): void
    {
        $user = User::factory()->create();
        $user->pushSubscriptions()->create(['endpoint' => 'https://fcm.googleapis.com/x', 'endpoint_hash' => hash('sha256', 'https://fcm.googleapis.com/x'), 'public_key' => 'k', 'auth_token' => 'a']);
        $token = Password::broker()->createToken($user);

        $this->postJson('/api/auth/reset-password', ['token' => $token, 'email' => $user->email, 'password' => 'clave-nueva-1', 'password_confirmation' => 'clave-nueva-1'])->assertOk();

        $this->assertSame(0, $user->pushSubscriptions()->count());
    }
}
