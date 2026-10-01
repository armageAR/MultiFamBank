<?php

namespace App\Http\Controllers\Platform;

use App\Enums\BankStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\PlatformBankDetailResource;
use App\Http\Resources\PlatformBankResource;
use App\Models\Bank;
use App\Services\BankLifecycle;
use App\Services\BankProvisioning;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class BankController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $data = $request->validate([
            'status' => ['nullable', Rule::enum(BankStatus::class)],
            'search' => ['nullable', 'string', 'max:120'],
        ]);

        $banks = Bank::query()
            ->with(['admin', 'adminInvitation'])
            ->when($data['status'] ?? null, fn ($query, $status) => $query->where('status', $status))
            ->when($data['search'] ?? null, function ($query, $search) {
                // "!" escapes LIKE wildcards; a backslash confuses PDO's placeholder parsing on PostgreSQL.
                $term = '%'.preg_replace('/[!%_]/', '!$0', mb_strtolower($search)).'%';
                $query->where(fn ($query) => $query
                    ->whereRaw("lower(name) like ? escape '!'", [$term])
                    ->orWhereRaw("admin_email like ? escape '!'", [$term]));
            })
            ->latest('id')
            ->paginate(25);

        $counts = Bank::query()->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');

        return PlatformBankResource::collection($banks)->additional([
            'counts' => collect(BankStatus::cases())->mapWithKeys(fn ($status) => [$status->value => (int) ($counts[$status->value] ?? 0)]),
        ]);
    }

    public function store(Request $request, BankProvisioning $provisioning): JsonResponse
    {
        $data = $request->validate([
            'admin_email' => ['required', 'email:rfc', 'max:255'],
            'admin_name' => ['required', 'string', 'max:120'],
        ]);

        $result = $provisioning->createWithAdminInvitation($data['admin_email'], $data['admin_name'], $request->user());

        return $this->invitationResponse($result, 201);
    }

    public function show(Bank $bank): PlatformBankDetailResource
    {
        return new PlatformBankDetailResource($bank->load(['admin', 'adminInvitation', 'memberships.user']));
    }

    /** Corrects the administrator's name or email. */
    public function updateAdmin(Request $request, Bank $bank, BankProvisioning $provisioning): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email:rfc', 'max:255'],
        ]);

        $result = $provisioning->updateAdministrator($bank, $data['name'], $data['email'], $request->user());
        $bank = $result['bank']->fresh(['admin', 'adminInvitation', 'memberships.user']);

        return response()->json([
            'data' => new PlatformBankDetailResource($bank),
            // Set when a pending administrator's email changed and a new invitation was issued.
            'email_sent' => $result['email_sent'],
            'invitation_url' => $result['accept_url'] && config('multifambank.expose_invitation_links') ? $result['accept_url'] : null,
        ]);
    }

    /** Sets a password chosen by the superadmin; the administrator is signed out everywhere. */
    public function setAdminPassword(Request $request, Bank $bank, BankProvisioning $provisioning): JsonResponse
    {
        $data = $request->validate(['password' => ['required', 'confirmed', Password::min(8)]]);

        $provisioning->setAdministratorPassword($bank, $data['password']);

        return response()->json(['message' => 'Contraseña actualizada. El administrador tiene que volver a ingresar.']);
    }

    /** pause | resume | deactivate | reactivate */
    public function changeStatus(Request $request, Bank $bank, BankLifecycle $lifecycle): PlatformBankDetailResource
    {
        $action = $request->validate(['action' => ['required', Rule::in(['pause', 'resume', 'deactivate', 'reactivate'])]])['action'];

        $bank = $lifecycle->{$action}($bank);

        return new PlatformBankDetailResource($bank->fresh(['admin', 'adminInvitation', 'memberships.user']));
    }

    /** Issues a new administrator invitation; earlier links stop working. */
    public function resendInvitation(Request $request, Bank $bank, BankProvisioning $provisioning): JsonResponse
    {
        return $this->invitationResponse($provisioning->resendAdminInvitation($bank, $request->user()), 200);
    }

    /** @param  array{bank: Bank, accept_url: string, email_sent: bool}  $result */
    private function invitationResponse(array $result, int $status): JsonResponse
    {
        $bank = $result['bank']->fresh(['admin', 'adminInvitation']);

        return response()->json([
            'data' => new PlatformBankResource($bank),
            'email_sent' => $result['email_sent'],
            // Only while email delivery is not configured; see config/multifambank.php.
            'invitation_url' => config('multifambank.expose_invitation_links') ? $result['accept_url'] : null,
        ], $status);
    }
}
