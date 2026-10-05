<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['multifambank.turnstile.secret_key' => null]);
    }

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

    public function test_password_reset_email_is_in_spanish(): void
    {
        // Production runs with APP_LOCALE=es; Laravel's own email texts come from lang/es.json.
        app()->setLocale('es');
        $mail = (new ResetPassword('token'))->toMail(User::factory()->create());
        $html = (string) $mail->render();

        $this->assertSame('Restablecé tu contraseña', $mail->subject);
        foreach (['¡Hola!', 'Restablecer contraseña', 'El link vence en 60 minutos.', 'Saludos,', 'no funciona, copiá y pegá', 'Todos los derechos reservados.'] as $text) {
            $this->assertStringContainsString($text, $html);
        }
        foreach (['Hello', 'Reset Password', 'Regards', 'trouble clicking', 'All rights reserved'] as $text) {
            $this->assertStringNotContainsString($text, $html);
        }
    }

    public function test_forgot_password_does_not_reveal_unknown_emails(): void
    {
        $this->postJson('/api/auth/forgot-password', ['email' => 'nobody@example.com'])->assertOk();
    }

    public function test_with_turnstile_on_sign_in_needs_a_verified_person(): void
    {
        config(['multifambank.turnstile.secret_key' => 'secret']);
        User::factory()->create(['email' => 'ana@example.com']);
        Http::fakeSequence('challenges.cloudflare.com/*')
            ->push(['success' => false, 'error-codes' => ['invalid-input-response']])
            ->push(['success' => true]);

        // Not even a correct password gets through without the check.
        $this->postJson('/api/auth/login', ['email' => 'ana@example.com', 'password' => 'password'])
            ->assertJsonValidationErrors(['turnstile_token' => 'No pudimos confirmar que seas una persona'])->assertJsonMissing(['token']);
        $this->postJson('/api/auth/login', ['email' => 'ana@example.com', 'password' => 'password', 'turnstile_token' => 'token-falso'])
            ->assertJsonValidationErrors('turnstile_token');
        $this->postJson('/api/auth/login', ['email' => 'ana@example.com', 'password' => 'password', 'turnstile_token' => 'token-ok'])->assertOk();

        Http::assertSent(fn (HttpRequest $request) => $request['secret'] === 'secret' && $request['response'] === 'token-ok');
        Http::assertSentCount(2);
    }

    public function test_with_turnstile_on_a_reset_link_needs_a_verified_person(): void
    {
        Notification::fake();
        config(['multifambank.turnstile.secret_key' => 'secret']);
        $user = User::factory()->create(['email' => 'ana@example.com']);
        Http::fake(['challenges.cloudflare.com/*' => Http::response(['success' => true])]);

        $this->postJson('/api/auth/forgot-password', ['email' => 'ana@example.com'])->assertJsonValidationErrors('turnstile_token');
        Notification::assertNothingSent();

        $this->postJson('/api/auth/forgot-password', ['email' => 'ana@example.com', 'turnstile_token' => 'token-ok'])->assertOk();
        Notification::assertSentTo($user, ResetPassword::class);
    }

    public function test_an_email_is_locked_after_repeated_failures_from_any_ip(): void
    {
        User::factory()->create(['email' => 'ana@example.com']);
        User::factory()->create(['email' => 'luis@example.com']);

        // Spread over many IPs, as a distributed attack would.
        for ($i = 1; $i <= 10; $i++) {
            $this->withServerVariables(['REMOTE_ADDR' => "10.0.0.$i"])
                ->postJson('/api/auth/login', ['email' => 'ana@example.com', 'password' => "intento-$i"])->assertUnprocessable();
        }

        $this->withServerVariables(['REMOTE_ADDR' => '10.0.1.1'])
            ->postJson('/api/auth/login', ['email' => ' ANA@example.com', 'password' => 'password'])
            ->assertTooManyRequests()->assertJsonPath('message', fn (string $message) => str_contains($message, 'demasiados intentos fallidos'))->assertHeader('Retry-After');
        $this->withServerVariables(['REMOTE_ADDR' => '10.0.1.1'])
            ->postJson('/api/auth/login', ['email' => 'luis@example.com', 'password' => 'password'])->assertOk();

        $this->travel(16)->minutes();
        $this->withServerVariables(['REMOTE_ADDR' => '10.0.1.2'])
            ->postJson('/api/auth/login', ['email' => 'ana@example.com', 'password' => 'password'])->assertOk();
    }

    public function test_resetting_the_password_lifts_the_lockout(): void
    {
        Notification::fake();
        $user = User::factory()->create(['email' => 'ana@example.com']);
        for ($i = 1; $i <= 10; $i++) {
            $this->withServerVariables(['REMOTE_ADDR' => "10.0.0.$i"])
                ->postJson('/api/auth/login', ['email' => 'ana@example.com', 'password' => 'nope'])->assertUnprocessable();
        }

        $this->postJson('/api/auth/forgot-password', ['email' => 'ana@example.com'])->assertOk();
        $token = null;
        Notification::assertSentTo($user, ResetPassword::class, function (ResetPassword $notification) use (&$token) {
            $token = $notification->token;

            return true;
        });
        $this->postJson('/api/auth/reset-password', [
            'token' => $token,
            'email' => 'ana@example.com',
            'password' => 'nueva-clave-segura',
            'password_confirmation' => 'nueva-clave-segura',
        ])->assertOk();

        $this->postJson('/api/auth/login', ['email' => 'ana@example.com', 'password' => 'nueva-clave-segura'])->assertOk();
    }

    public function test_a_successful_sign_in_clears_earlier_failures(): void
    {
        User::factory()->create(['email' => 'ana@example.com']);

        foreach ([1, 2] as $round) {
            for ($i = 1; $i <= 9; $i++) {
                $this->withServerVariables(['REMOTE_ADDR' => "10.$round.0.$i"])
                    ->postJson('/api/auth/login', ['email' => 'ana@example.com', 'password' => 'nope'])->assertUnprocessable();
            }
            $this->withServerVariables(['REMOTE_ADDR' => "10.$round.1.1"])
                ->postJson('/api/auth/login', ['email' => 'ana@example.com', 'password' => 'password'])->assertOk();
        }
    }

    public function test_one_ip_cannot_try_many_accounts(): void
    {
        for ($i = 1; $i <= 30; $i++) {
            $this->postJson('/api/auth/login', ['email' => "user$i@example.com", 'password' => 'nope'])->assertUnprocessable();
        }

        $this->postJson('/api/auth/login', ['email' => 'otro@example.com', 'password' => 'nope'])->assertTooManyRequests();
        $this->withServerVariables(['REMOTE_ADDR' => '10.9.9.9'])
            ->postJson('/api/auth/login', ['email' => 'otro@example.com', 'password' => 'nope'])->assertUnprocessable();
    }
}
