<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Operations have three types and no categories: savings deposit, savings withdrawal (client money)
 * and expense (bank money). The funding source follows from the type. The original request is kept
 * next to the final values the administrator confirms, including an editable operation date.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE money_requests DROP CONSTRAINT IF EXISTS money_requests_source_check');
            DB::statement('ALTER TABLE money_requests DROP CONSTRAINT IF EXISTS money_requests_deposit_source_check');
            DB::statement('ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_kind_check');
            DB::statement('ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_savings_check');
        }

        Schema::table('money_requests', function (Blueprint $table) {
            $table->dropColumn(['requested_funding_source', 'funding_source', 'category']);
        });

        Schema::table('money_requests', function (Blueprint $table) {
            $table->string('requested_type')->after('type');
            $table->text('requested_description')->nullable()->after('requested_amount_ars');
            // When the money changed hands. Set at confirmation unless the administrator chose a date;
            // editable afterwards. Reports group by this date.
            $table->timestamp('occurred_at')->nullable()->after('description');
            $table->index(['bank_id', 'occurred_at']);
        });

        Schema::table('ledger_entries', function (Blueprint $table) {
            $table->dropColumn('category');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE money_requests ADD CONSTRAINT money_requests_requested_type_check CHECK (requested_type IN ('savings_deposit', 'savings_withdrawal', 'expense'))");
            // Asking for bank money always needs an explanation.
            DB::statement("ALTER TABLE money_requests ADD CONSTRAINT money_requests_expense_description_check CHECK (type <> 'expense' OR length(trim(coalesce(description, ''))) > 0)");
            DB::statement("ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_kind_check CHECK (kind IN ('savings_credit', 'savings_debit', 'bank_expense'))");
            DB::statement("ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_savings_check CHECK (kind = 'bank_expense' OR (savings_account_id IS NOT NULL AND amount_usd IS NOT NULL AND exchange_rate IS NOT NULL))");
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE money_requests DROP CONSTRAINT IF EXISTS money_requests_requested_type_check');
            DB::statement('ALTER TABLE money_requests DROP CONSTRAINT IF EXISTS money_requests_expense_description_check');
        }

        Schema::table('money_requests', function (Blueprint $table) {
            $table->dropIndex(['bank_id', 'occurred_at']);
            $table->dropColumn(['requested_type', 'requested_description', 'occurred_at']);
        });

        Schema::table('money_requests', function (Blueprint $table) {
            $table->string('requested_funding_source')->default('client_savings');
            $table->string('funding_source')->default('client_savings');
            $table->string('category')->nullable();
        });

        Schema::table('ledger_entries', function (Blueprint $table) {
            $table->string('category')->nullable();
        });
    }
};
