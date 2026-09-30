<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Requires an administrator and exposes their bank as the "bank" request attribute. */
class EnsureBankAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $bank = $request->user()?->administeredBank;
        abort_unless($bank !== null, 403, 'No administrás ningún banco.');

        $request->attributes->set('bank', $bank);

        return $next($request);
    }
}
