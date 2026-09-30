<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A user's client membership in a bank.
        Schema::create('bank_memberships', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bank_id')->constrained()->restrictOnDelete();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->string('status')->default('active');
            $table->timestamps();

            $table->unique(['bank_id', 'user_id']);
            $table->index('user_id');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE bank_memberships ADD CONSTRAINT bank_memberships_status_check CHECK (status IN ('active', 'removed'))");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('bank_memberships');
    }
};
