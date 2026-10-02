<?php

namespace App\Http\Controllers\Client;

use App\Http\Controllers\Admin\OperationRules;
use App\Http\Controllers\Controller;
use App\Http\Resources\MoneyRequestResource;
use App\Models\BankMembership;
use App\Models\MoneyRequest;
use App\Services\Notifier;
use App\Services\Operations;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class OperationController extends Controller
{
    public function __construct(private Operations $operations) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        return MoneyRequestResource::collection(
            MoneyRequest::with('membership.user')->where('bank_membership_id', $this->membership($request)->id)
                ->orderByRaw('coalesce(occurred_at, created_at) desc')->paginate(30),
        );
    }

    public function store(Request $request, Notifier $notifier): JsonResponse
    {
        $data = $request->validate([
            'id' => ['nullable', 'uuid'],
            // The quote the client was shown; accepted only if it is still the current one.
            'exchange_rate' => ['nullable', ...OperationRules::rate()],
        ] + OperationRules::create());
        $existed = isset($data['id']) && MoneyRequest::whereKey($data['id'])->exists();

        $operation = $this->operations->request($this->membership($request), $request->user(), $data);

        if (! $existed) {
            $notifier->requestCreated($operation);
        }

        return response()->json(['data' => new MoneyRequestResource($operation->load('membership.user'))], $existed ? 200 : 201);
    }

    /** $bank is consumed by EnsureBankClient; it is listed so the request binds to the right parameter. */
    public function cancel(Request $request, string $bank, MoneyRequest $moneyRequest): MoneyRequestResource
    {
        abort_unless($moneyRequest->bank_membership_id === $this->membership($request)->id, 404);

        return new MoneyRequestResource($this->operations->cancel($moneyRequest, $request->user())->load('membership.user'));
    }

    private function membership(Request $request): BankMembership
    {
        return $request->attributes->get('membership');
    }
}
