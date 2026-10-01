<?php

namespace App\Http\Middleware;

use App\Enums\BankStatus;
use App\Enums\MembershipStatus;
use App\Models\Bank;
use App\Models\BankMembership;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Resolves the {bank} route parameter to the user's active membership. Deactivated banks do not
 * exist for their clients; paused banks remain readable (writes are refused by the services).
 */
class EnsureBankClient
{
    public function handle(Request $request, Closure $next): Response
    {
        $bank = $request->route('bank');
        $bankId = $bank instanceof Bank ? $bank->id : (int) $bank;

        $membership = BankMembership::with('bank')
            ->where('user_id', $request->user()->id)
            ->where('bank_id', $bankId)
            ->where('status', MembershipStatus::Active)
            ->whereHas('bank', fn ($query) => $query->where('status', '!=', BankStatus::Deactivated))
            ->first();

        abort_unless($membership !== null, 404, 'El banco no existe.');

        $request->attributes->set('membership', $membership);

        return $next($request);
    }
}
