<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CreateSuperadminCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_creates_the_superadmin_and_prints_a_set_password_link(): void
    {
        $this->artisan('superadmin:create', ['email' => 'Root@Example.com', 'name' => 'Root'])
            ->expectsOutputToContain(config('multifambank.urls.superadmin').'/restablecer-contrasena?token=')
            ->assertSuccessful();

        $user = User::sole();
        $this->assertTrue($user->is_superadmin);
        $this->assertSame('root@example.com', $user->email);
        $this->assertDatabaseCount('password_reset_tokens', 1);
    }

    public function test_it_promotes_an_existing_identity_instead_of_duplicating_it(): void
    {
        $user = User::factory()->create(['email' => 'root@example.com']);

        $this->artisan('superadmin:create', ['email' => 'root@example.com', 'name' => 'Ignored'])->assertSuccessful();

        $this->assertSame(1, User::count());
        $this->assertTrue($user->fresh()->is_superadmin);
    }

    public function test_there_can_only_be_one_superadmin(): void
    {
        User::factory()->superadmin()->create();

        $this->artisan('superadmin:create', ['email' => 'other@example.com', 'name' => 'Other'])->assertFailed();
        $this->assertSame(1, User::count());

        $this->expectException(UniqueConstraintViolationException::class);
        User::factory()->superadmin()->create();
    }
}
