<?php

use App\Http\Controllers\Admin\BankSetupController;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Auth\PasswordResetController;
use App\Http\Controllers\HealthController;
use App\Http\Controllers\InvitationController;
use App\Http\Controllers\Platform\BankController as PlatformBankController;
use App\Http\Middleware\EnsureBankAdmin;
use App\Http\Middleware\EnsureSuperadmin;
use Illuminate\Support\Facades\Route;

Route::get('/health', HealthController::class);

Route::prefix('auth')->group(function () {
    Route::middleware('throttle:auth')->group(function () {
        Route::post('/login', [AuthController::class, 'login']);
        Route::post('/forgot-password', [PasswordResetController::class, 'forgot']);
        Route::post('/reset-password', [PasswordResetController::class, 'reset']);
    });

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/logout', [AuthController::class, 'logout']);
    });
});

Route::prefix('invitations/{token}')->middleware('throttle:auth')->group(function () {
    Route::get('/', [InvitationController::class, 'show']);
    Route::post('/accept', [InvitationController::class, 'accept']);
});

Route::prefix('platform')->middleware(['auth:sanctum', EnsureSuperadmin::class])->group(function () {
    Route::get('/banks', [PlatformBankController::class, 'index']);
    Route::post('/banks', [PlatformBankController::class, 'store']);
    Route::post('/banks/{bank}/admin-invitation', [PlatformBankController::class, 'resendInvitation']);
});

Route::prefix('admin')->middleware(['auth:sanctum', EnsureBankAdmin::class])->group(function () {
    Route::get('/bank', [BankSetupController::class, 'show']);
    Route::put('/bank', [BankSetupController::class, 'update']);
});
