<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('access_requests', function (Blueprint $table) {
            // When the superadmin marked the person as contacted; null while still waiting.
            $table->timestamp('contacted_at')->nullable()->after('notified_at');
        });
    }

    public function down(): void
    {
        Schema::table('access_requests', function (Blueprint $table) {
            $table->dropColumn('contacted_at');
        });
    }
};
