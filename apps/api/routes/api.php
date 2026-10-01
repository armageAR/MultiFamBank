<?php

use App\Http\Controllers\Admin\BankSetupController;
use App\Http\Controllers\Admin\ClientController as AdminClientController;
use App\Http\Controllers\Admin\OperationController as AdminOperationController;
use App\Http\Controllers\Admin\ReportController;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Auth\PasswordResetController;
use App\Http\Controllers\Client\BankController as ClientBankController;
use App\Http\Controllers\Client\OperationController as ClientOperationController;
use App\Http\Controllers\ExchangeRateController;
use App\Http\Controllers\HealthController;
use App\Http\Controllers\InvitationController;
use App\Http\Controllers\Platform\BankController as PlatformBankController;
use App\Http\Controllers\PushSubscriptionController;
use App\Http\Middleware\EnsureBankAdmin;
use App\Http\Middleware\EnsureBankClient;
use App\Http\Middleware\EnsureSuperadmin;
use Illuminate\Support\Facades\Route;

Route::get('/health', HealthController::class);
Route::get('/push/public-key', [PushSubscriptionController::class, 'publicKey']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/exchange-rates', [ExchangeRateController::class, 'show'])->middleware('throttle:30,1');
    Route::middleware('throttle:10,1')->group(function () {
        Route::post('/push/subscriptions', [PushSubscriptionController::class, 'store']);
        Route::delete('/push/subscriptions', [PushSubscriptionController::class, 'destroy']);
        Route::post('/push/test', [PushSubscriptionController::class, 'test']);
    });
});

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
    Route::get('/banks/{bank}', [PlatformBankController::class, 'show']);
    Route::patch('/banks/{bank}/admin', [PlatformBankController::class, 'updateAdmin']);
    Route::post('/banks/{bank}/status', [PlatformBankController::class, 'changeStatus']);
    Route::put('/banks/{bank}/admin/password', [PlatformBankController::class, 'setAdminPassword']);
    Route::post('/banks/{bank}/admin-invitation', [PlatformBankController::class, 'resendInvitation']);
});

Route::prefix('admin')->middleware(['auth:sanctum', EnsureBankAdmin::class])->group(function () {
    Route::get('/bank', [BankSetupController::class, 'show']);
    Route::put('/bank', [BankSetupController::class, 'update']);
    Route::get('/dashboard', [ReportController::class, 'dashboard']);
    Route::get('/reports/expenses', [ReportController::class, 'expenses']);

    Route::get('/clients', [AdminClientController::class, 'index']);
    Route::post('/clients/invitations', [AdminClientController::class, 'invite']);
    Route::post('/clients/invitations/{invitation}/resend', [AdminClientController::class, 'resendInvitation']);
    Route::delete('/clients/invitations/{invitation}', [AdminClientController::class, 'revokeInvitation']);
    Route::patch('/clients/{membership}', [AdminClientController::class, 'update']);
    Route::put('/clients/{membership}/password', [AdminClientController::class, 'setPassword']);
    Route::post('/clients/{membership}/password-reset', [AdminClientController::class, 'sendPasswordReset'])->middleware('throttle:5,1');
    Route::post('/clients/{membership}/deactivate', [AdminClientController::class, 'deactivate']);
    Route::post('/clients/{membership}/reactivate', [AdminClientController::class, 'reactivate']);
    Route::get('/clients/{membership}/operations', [AdminClientController::class, 'operations']);
    Route::post('/clients/{membership}/operations', [AdminClientController::class, 'record']);

    Route::get('/operations/pending', [AdminOperationController::class, 'pending']);
    Route::patch('/operations/{moneyRequest}', [AdminOperationController::class, 'update']);
    Route::post('/operations/{moneyRequest}/confirm', [AdminOperationController::class, 'confirm']);
    Route::post('/operations/{moneyRequest}/reject', [AdminOperationController::class, 'reject']);
    Route::put('/operations/{moneyRequest}/date', [AdminOperationController::class, 'changeDate']);
});

Route::prefix('client')->middleware('auth:sanctum')->group(function () {
    Route::get('/banks', [ClientBankController::class, 'index']);

    Route::prefix('banks/{bank}')->middleware(EnsureBankClient::class)->group(function () {
        Route::get('/', [ClientBankController::class, 'show']);
        Route::get('/operations', [ClientOperationController::class, 'index']);
        Route::post('/operations', [ClientOperationController::class, 'store']);
        Route::post('/operations/{moneyRequest}/cancel', [ClientOperationController::class, 'cancel']);
    });
});
