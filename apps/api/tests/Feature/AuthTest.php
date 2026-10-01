<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_returns_a_token_and_normalizes_the_email(): void
    {
        User::factory()->create(['email' => 'ana@example.com']);

        $response = $this->postJson('/api/auth/login', ['email' => '  ANA@Example.com ', 'password' => 'password']);

        $response->assertOk()->assertJsonPath('user.email', 'ana@example.com');
        $this->assertNotNull(User::where('email', 'ana@example.com')->value('last_seen_at'));
        $this->withToken($response->json('token'))->getJson('/api/auth/me')->assertOk()->assertJsonPath('data.email', 'ana@example.com');
    }

    public function test_login_rejects_wrong_password_and_inactive_users(): void
    {
        User::factory()->create(['email' => 'ana@example.com']);
        User::factory()->create(['email' => 'off@example.com', 'active' => false]);

        $this->postJson('/api/auth/login', ['email' => 'ana@example.com', 'password' => 'nope'])->assertUnprocessable();
        $this->postJson('/api/auth/login', ['email' => 'off@example.com', 'password' => 'password'])->assertUnprocessable();
    }

    public function test_logout_revokes_the_token(): void
    {
        User::factory()->create(['email' => 'ana@example.com']);
        $token = $this->postJson('/api/auth/login', ['email' => 'ana@example.com', 'password' => 'password'])->json('token');

        $this->withToken($token)->postJson('/api/auth/logout')->assertNoContent();

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/auth/me')->assertUnauthorized();
    }

    public function test_password_reset_link_points_to_the_superadmin_app_and_resets_the_password(): void
    {
        Notification::fake();
        $user = User::factory()->superadmin()->create(['email' => 'root@example.com']);

        $this->postJson('/api/auth/forgot-password', ['email' => 'root@example.com'])->assertOk();

        $url = null;
        Notification::assertSentTo($user, ResetPassword::class, function (ResetPassword $notification) use ($user, &$url) {
            $url = $notification->toMail($user)->actionUrl;

            return true;
        });
        $this->assertStringStartsWith(config('multifambank.urls.superadmin').'/restablecer-contrasena?', $url);

        parse_str(parse_url($url, PHP_URL_QUERY), $query);
        $this->postJson('/api/auth/reset-password', [
            'token' => $query['token'],
            'email' => $query['email'],
            'password' => 'nueva-clave-segura',
            'password_confirmation' => 'nueva-clave-segura',
        ])->assertOk();

        $this->postJson('/api/auth/login', ['email' => 'root@example.com', 'password' => 'nueva-clave-segura'])->assertOk();
    }

    public function test_forgot_password_does_not_reveal_unknown_emails(): void
    {
        $this->postJson('/api/auth/forgot-password', ['email' => 'nobody@example.com'])->assertOk();
    }
}
