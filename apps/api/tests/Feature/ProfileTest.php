<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ProfileTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_person_changes_their_email_and_password_with_the_current_password(): void
    {
        $user = User::factory()->create(['email' => 'ana@example.com']);
        $other = $user->createToken('other-device');
        $token = $user->createToken('this-device')->plainTextToken;

        $this->withToken($token)->putJson('/api/auth/profile', ['current_password' => 'wrong', 'email' => 'x@example.com'])
            ->assertJsonValidationErrors('current_password');

        $this->withToken($token)->putJson('/api/auth/profile', [
            'current_password' => 'password',
            'email' => 'Ana.Nueva@Example.com',
            'password' => 'clave-nueva-1',
            'password_confirmation' => 'clave-nueva-1',
        ])->assertOk()->assertJsonPath('data.email', 'ana.nueva@example.com');

        $user->refresh();
        $this->assertTrue(Hash::check('clave-nueva-1', $user->password));
        $this->assertNull($user->email_verified_at);
        // Other devices are signed out; this one keeps working.
        $this->assertNull($user->tokens()->find($other->accessToken->id));
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/auth/me')->assertOk();
    }

    public function test_an_email_in_use_is_refused(): void
    {
        User::factory()->create(['email' => 'taken@example.com']);
        $user = User::factory()->create();

        $this->withToken($user->createToken('t')->plainTextToken)
            ->putJson('/api/auth/profile', ['current_password' => 'password', 'email' => 'taken@example.com'])
            ->assertJsonValidationErrors('email');
    }
}
