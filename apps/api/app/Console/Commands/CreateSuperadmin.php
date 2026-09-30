<?php

namespace App\Console\Commands;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

class CreateSuperadmin extends Command
{
    protected $signature = 'superadmin:create {email} {name}';

    protected $description = 'Creates the single platform superadmin and prints a one-time link to set the password';

    public function handle(): int
    {
        $email = User::normalizeEmail($this->argument('email'));

        if (User::where('is_superadmin', true)->exists()) {
            $this->error('Ya existe un superadmin. Solo puede haber uno.');

            return self::FAILURE;
        }

        $user = DB::transaction(function () use ($email) {
            // An existing identity is promoted instead of duplicated.
            $user = User::firstOrNew(['email' => $email]);
            $isNew = ! $user->exists;

            if ($isNew) {
                $user->name = $this->argument('name');
                // Unusable until the password is set through the link below.
                $user->password = Str::random(64);
            }

            $user->is_superadmin = true;
            $user->save();

            AuditLog::record('superadmin.created', $user, null, null, ['email' => $email, 'new_user' => $isNew]);

            return $user;
        });

        // The password never passes through the console, shell history, or environment variables.
        $url = config('multifambank.urls.superadmin').'/restablecer-contrasena?'.http_build_query([
            'token' => Password::broker()->createToken($user),
            'email' => $user->email,
        ]);

        $this->info("Superadmin: {$user->email}");
        $this->line('Definí la contraseña en este link (vence en '.config('auth.passwords.users.expire').' minutos, un solo uso):');
        $this->line($url);

        return self::SUCCESS;
    }
}
