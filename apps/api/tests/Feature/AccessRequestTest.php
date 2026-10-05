<?php

namespace Tests\Feature;

use App\Mail\AccessRequestReceivedMail;
use App\Models\AccessRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AccessRequestTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        config([
            'multifambank.access_requests.notify_to' => 'owner@example.com',
            'multifambank.access_requests.mailer' => 'resend',
            'multifambank.turnstile.secret_key' => null,
        ]);
        Http::preventStrayRequests();
    }

    public function test_a_request_is_stored_and_notifies_the_configured_recipient(): void
    {
        $this->postJson('/api/access-requests', ['name' => ' Laura Pérez ', 'email' => 'Laura@Example.com'])
            ->assertCreated()->assertJsonPath('data.email', 'laura@example.com');

        $request = AccessRequest::sole();
        $this->assertSame('Laura Pérez', $request->name);
        $this->assertNotNull($request->notified_at);
        Mail::assertSent(AccessRequestReceivedMail::class, fn ($mail) => $mail->hasTo('owner@example.com') && $mail->hasReplyTo('laura@example.com'));
    }

    public function test_the_same_email_cannot_ask_twice(): void
    {
        $this->postJson('/api/access-requests', ['name' => 'Laura', 'email' => 'laura@example.com'])->assertCreated();
        $this->postJson('/api/access-requests', ['name' => 'Otra', 'email' => ' LAURA@example.com'])
            ->assertJsonValidationErrors(['email' => 'Ya tenemos una solicitud con este email']);

        $this->assertSame(1, AccessRequest::count());
        Mail::assertSentCount(1);
    }

    public function test_invalid_input_and_bots_are_refused(): void
    {
        $this->postJson('/api/access-requests', ['name' => '', 'email' => 'no-es-un-email'])->assertJsonValidationErrors(['name', 'email']);
        $this->postJson('/api/access-requests', ['name' => 'Bot', 'email' => 'bot@example.com', 'website' => 'http://spam'])->assertJsonValidationErrors('website');

        $this->assertSame(0, AccessRequest::count());
        Mail::assertNothingSent();
    }

    public function test_a_mailer_that_delivers_nothing_leaves_the_request_unnotified(): void
    {
        config(['multifambank.access_requests.mailer' => 'log']);

        $this->postJson('/api/access-requests', ['name' => 'Laura', 'email' => 'laura@example.com'])->assertCreated();

        $this->assertNull(AccessRequest::sole()->notified_at);
    }

    public function test_the_name_cannot_inject_links_into_the_email(): void
    {
        $request = AccessRequest::create(['name' => '[Verificá tu cuenta](https://evil.example)', 'email' => 'x@example.com']);

        $html = (new AccessRequestReceivedMail($request))->render();

        $this->assertStringNotContainsString('href="https://evil.example"', $html);
    }

    public function test_without_a_recipient_the_request_is_kept_but_nobody_is_emailed(): void
    {
        config(['multifambank.access_requests.notify_to' => null]);

        $this->postJson('/api/access-requests', ['name' => 'Laura', 'email' => 'laura@example.com'])->assertCreated();

        $this->assertNull(AccessRequest::sole()->notified_at);
        Mail::assertNothingSent();
    }

    public function test_with_turnstile_on_a_verified_person_gets_through(): void
    {
        config(['multifambank.turnstile.secret_key' => 'secret']);
        Http::fake(['challenges.cloudflare.com/*' => Http::response(['success' => true])]);

        $this->postJson('/api/access-requests', ['name' => 'Laura', 'email' => 'laura@example.com', 'turnstile_token' => 'token-ok'])->assertCreated();

        Http::assertSent(fn (HttpRequest $request) => $request['secret'] === 'secret' && $request['response'] === 'token-ok' && $request['remoteip'] === '127.0.0.1');
        $this->assertSame(1, AccessRequest::count());
    }

    public function test_with_turnstile_on_missing_rejected_or_unverifiable_tokens_are_refused(): void
    {
        config(['multifambank.turnstile.secret_key' => 'secret']);
        // A known email must not be revealed to an unverified sender.
        AccessRequest::create(['name' => 'Laura', 'email' => 'laura@example.com']);
        Http::fakeSequence('challenges.cloudflare.com/*')
            ->push(['success' => false, 'error-codes' => ['invalid-input-response']])
            ->pushFailedConnection();

        $this->postJson('/api/access-requests', ['name' => 'Bot', 'email' => 'laura@example.com'])
            ->assertJsonValidationErrors(['turnstile_token' => 'No pudimos confirmar que seas una persona'])->assertJsonMissingValidationErrors('email');
        $this->postJson('/api/access-requests', ['name' => 'Bot', 'email' => 'bot@example.com', 'turnstile_token' => 'token-falso'])
            ->assertJsonValidationErrors('turnstile_token');
        $this->postJson('/api/access-requests', ['name' => 'Bot', 'email' => 'bot@example.com', 'turnstile_token' => 'token'])
            ->assertJsonValidationErrors('turnstile_token');

        Http::assertSentCount(2);
        $this->assertSame(1, AccessRequest::count());
        Mail::assertNothingSent();
    }

    public function test_the_superadmin_lists_requests_and_marks_them_contacted(): void
    {
        $laura = AccessRequest::create(['name' => 'Laura Pérez', 'email' => 'laura@example.com']);
        AccessRequest::create(['name' => 'Tomás', 'email' => 'tomas@example.com']);

        Sanctum::actingAs(User::factory()->create());
        $this->getJson('/api/platform/access-requests')->assertForbidden();

        Sanctum::actingAs(User::factory()->superadmin()->create());
        $list = $this->getJson('/api/platform/access-requests')->assertOk()->json();
        $this->assertSame(['Tomás', 'Laura Pérez'], array_column($list['data'], 'name'));
        $this->assertSame(['pending' => 2, 'contacted' => 0], $list['counts']);
        $this->assertSame(['laura@example.com'], array_column($this->getJson('/api/platform/access-requests?search=PÉREZ')->json('data'), 'email'));

        $this->patchJson("/api/platform/access-requests/{$laura->id}", ['contacted' => true])->assertOk()->assertJsonPath('data.contacted_at', fn ($v) => $v !== null);
        $this->assertSame(['Laura Pérez'], array_column($this->getJson('/api/platform/access-requests?status=contacted')->json('data'), 'name'));
        $this->assertSame(['Tomás'], array_column($this->getJson('/api/platform/access-requests?status=pending')->json('data'), 'name'));

        $this->patchJson("/api/platform/access-requests/{$laura->id}", ['contacted' => false])->assertOk()->assertJsonPath('data.contacted_at', null);
        $this->assertSame(2, $this->getJson('/api/platform/access-requests')->json('counts.pending'));
    }
}
