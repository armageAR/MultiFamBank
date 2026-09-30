<?php

namespace App\Http\Controllers\Platform;

use App\Enums\BankStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\PlatformBankResource;
use App\Models\Bank;
use App\Services\BankProvisioning;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

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
                $term = '%'.mb_strtolower($search).'%';
                $query->where(fn ($query) => $query
                    ->whereRaw('lower(name) like ?', [$term])
                    ->orWhere('admin_email', 'like', $term));
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
        $bank = $result['bank']->load(['admin', 'adminInvitation']);

        return response()->json([
            'data' => new PlatformBankResource($bank),
            'email_sent' => $result['email_sent'],
            // Only while email delivery is not configured; see config/multifambank.php.
            'invitation_url' => config('multifambank.expose_invitation_links') ? $result['accept_url'] : null,
        ], 201);
    }
}
