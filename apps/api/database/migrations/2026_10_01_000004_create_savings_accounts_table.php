<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A client's USD savings within one bank. Available = balance_usd - reserved_usd.
        Schema::create('savings_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bank_id')->constrained()->restrictOnDelete();
            $table->foreignId('bank_membership_id')->unique()->constrained()->restrictOnDelete();
            $table->decimal('balance_usd', 14, 2)->default(0);
            $table->decimal('reserved_usd', 14, 2)->default(0);
            $table->timestamps();

            $table->index('bank_id');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE savings_accounts ADD CONSTRAINT savings_accounts_reserved_check CHECK (reserved_usd >= 0 AND reserved_usd <= balance_usd)');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('savings_accounts');
    }
};
