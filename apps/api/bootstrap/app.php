<?php

use App\Exceptions\DomainRuleException;
use App\Http\Middleware\RecordLastSeen;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Railway's edge proxy is the only way in: trust it so request IPs (rate limits) are the visitor's.
        $middleware->trustProxies(at: '*', headers: Request::HEADER_X_FORWARDED_FOR | Request::HEADER_X_FORWARDED_PROTO);
        // Runs after authentication, so only requests with a valid session count as activity.
        $middleware->appendToGroup('api', RecordLastSeen::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(fn (Request $request) => $request->is('api/*') || $request->expectsJson());
        $exceptions->map(DomainRuleException::class, fn (DomainRuleException $e) => $e->toValidationException());
    })->create();
