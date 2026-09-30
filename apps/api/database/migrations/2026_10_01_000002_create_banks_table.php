<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('banks', function (Blueprint $table) {
            $table->id();
            // Null until the administrator completes the bank setup.
            $table->string('name')->nullable();
            $table->string('timezone')->default('America/Argentina/Buenos_Aires');
            $table->string('status')->default('pending_configuration');
            // Email assigned by the superadmin. Unique so a person can administer at most one bank,
            // including banks whose invitation is still pending; deactivation does not release it.
            $table->string('admin_email')->unique();
            $table->foreignId('admin_user_id')->nullable()->unique()->constrained('users')->restrictOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('activated_at')->nullable();
            $table->timestamp('paused_at')->nullable();
            $table->timestamp('deactivated_at')->nullable();
            $table->timestamps();

            $table->index('status');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE banks ADD CONSTRAINT banks_status_check CHECK (status IN ('pending_configuration', 'active', 'paused', 'deactivated'))");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('banks');
    }
};
