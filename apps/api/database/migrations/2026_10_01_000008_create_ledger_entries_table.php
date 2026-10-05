<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Confirmed movements: savings credits/debits and bank-funded expenses. Only the administrator's
        // corrections of a confirmed operation (amount, date, deletion) rewrite or remove a row.
        Schema::create('ledger_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bank_id')->constrained()->restrictOnDelete();
            $table->foreignId('bank_membership_id')->constrained()->restrictOnDelete();
            $table->foreignId('savings_account_id')->nullable()->constrained()->restrictOnDelete();
            // A confirmed request produces exactly one ledger entry.
            $table->foreignUuid('money_request_id')->nullable()->unique()->constrained()->restrictOnDelete();
            $table->string('kind');
            $table->decimal('amount_ars', 14, 2);
            $table->decimal('exchange_rate', 12, 4)->nullable();
            $table->decimal('amount_usd', 14, 2)->nullable();
            $table->string('category')->nullable();
            $table->text('description')->nullable();
            // Confirmation time: monthly reports group by this date.
            $table->timestamp('occurred_at');
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();

            $table->index(['bank_id', 'kind', 'occurred_at']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_kind_check CHECK (kind IN ('savings_credit', 'savings_debit', 'bank_expense'))");
            DB::statement("ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_savings_check CHECK (kind = 'bank_expense' OR (savings_account_id IS NOT NULL AND amount_usd IS NOT NULL AND exchange_rate IS NOT NULL))");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('ledger_entries');
    }
};
