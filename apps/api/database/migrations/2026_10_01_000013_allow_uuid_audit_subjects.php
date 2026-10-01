<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Money requests have UUID keys, so audit subjects can be numeric or UUID. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->string('subject_id', 36)->nullable()->change();
        });
    }

    public function down(): void
    {
        // Irreversible once UUID subjects exist; numeric ids would be lost by narrowing the type.
    }
};
