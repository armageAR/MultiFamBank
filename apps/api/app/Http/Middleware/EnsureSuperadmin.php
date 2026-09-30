<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureSuperadmin
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless($request->user()?->is_superadmin, 403, 'Solo el administrador de la plataforma puede hacer esto.');

        return $next($request);
    }
}
