<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('money_requests', function (Blueprint $table) {
            // Client-generated UUID, also the idempotency key for offline synchronization.
            $table->uuid('id')->primary();
            $table->foreignId('bank_id')->constrained()->restrictOnDelete();
            $table->foreignId('bank_membership_id')->constrained()->restrictOnDelete();
            $table->string('type');
            $table->string('status')->default('pending');

            // Values as originally requested.
            $table->string('requested_funding_source');
            $table->decimal('requested_amount_ars', 14, 2);

            // Final values; administrators may change them before confirming.
            $table->string('funding_source');
            $table->decimal('amount_ars', 14, 2);
            $table->decimal('exchange_rate', 12, 4)->nullable();
            $table->decimal('amount_usd', 14, 2)->nullable();

            $table->string('category')->nullable();
            $table->text('description')->nullable();

            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('confirmed_at')->nullable();
            $table->foreignId('confirmed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('rejected_at')->nullable();
            $table->foreignId('rejected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('rejection_reason')->nullable();
            $table->timestamp('canceled_at')->nullable();
            $table->timestamps();

            $table->index(['bank_id', 'status']);
            $table->index(['bank_id', 'confirmed_at']);
            $table->index('bank_membership_id');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE money_requests ADD CONSTRAINT money_requests_type_check CHECK (type IN ('savings_deposit', 'savings_withdrawal', 'expense'))");
            DB::statement("ALTER TABLE money_requests ADD CONSTRAINT money_requests_status_check CHECK (status IN ('pending', 'confirmed', 'rejected', 'canceled'))");
            DB::statement("ALTER TABLE money_requests ADD CONSTRAINT money_requests_source_check CHECK (funding_source IN ('client_savings', 'bank_funds') AND requested_funding_source IN ('client_savings', 'bank_funds'))");
            // Deposits always go to client savings; they can never be bank-funded.
            DB::statement("ALTER TABLE money_requests ADD CONSTRAINT money_requests_deposit_source_check CHECK (type <> 'savings_deposit' OR funding_source = 'client_savings')");
            DB::statement('ALTER TABLE money_requests ADD CONSTRAINT money_requests_amounts_check CHECK (amount_ars > 0 AND requested_amount_ars > 0)');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('money_requests');
    }
};
