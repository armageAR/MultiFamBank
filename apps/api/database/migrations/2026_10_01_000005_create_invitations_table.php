<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invitations', function (Blueprint $table) {
            $table->id();
            $table->string('type');
            $table->foreignId('bank_id')->constrained()->restrictOnDelete();
            $table->string('email');
            $table->string('name');
            // Only a SHA-256 hash of the token is stored; the plain token travels in the email link.
            $table->string('token_hash', 64)->unique();
            $table->foreignId('invited_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('expires_at');
            $table->timestamp('accepted_at')->nullable();
            $table->foreignId('accepted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('revoked_at')->nullable();
            $table->timestamp('last_sent_at')->nullable();
            $table->unsignedInteger('send_count')->default(0);
            $table->timestamps();

            $table->index(['bank_id', 'type']);
            $table->index('email');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE invitations ADD CONSTRAINT invitations_type_check CHECK (type IN ('bank_admin', 'bank_client'))");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('invitations');
    }
};
