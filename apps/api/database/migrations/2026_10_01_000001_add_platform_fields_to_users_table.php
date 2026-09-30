<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_superadmin')->default(false)->after('password');
            $table->boolean('active')->default(true)->after('is_superadmin');
            $table->timestamp('last_login_at')->nullable()->after('active');
        });

        // There is exactly one platform superadmin.
        DB::statement('CREATE UNIQUE INDEX users_single_superadmin ON users (is_superadmin) WHERE is_superadmin');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS users_single_superadmin');

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['is_superadmin', 'active', 'last_login_at']);
        });
    }
};
