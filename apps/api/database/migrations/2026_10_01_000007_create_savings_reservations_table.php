<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // USD held by a pending savings withdrawal; released on rejection/cancellation, settled on confirmation.
        Schema::create('savings_reservations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('savings_account_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('money_request_id')->unique()->constrained()->restrictOnDelete();
            $table->decimal('amount_usd', 14, 2);
            $table->timestamp('released_at')->nullable();
            $table->timestamp('settled_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('savings_reservations');
    }
};
