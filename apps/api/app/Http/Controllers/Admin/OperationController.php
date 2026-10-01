<?php

namespace App\Http\Controllers\Admin;

use App\Enums\MoneyRequestStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\MoneyRequestResource;
use App\Models\Bank;
use App\Models\MoneyRequest;
use App\Services\Notifier;
use App\Services\Operations;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class OperationController extends Controller
{
    public function __construct(private Operations $operations, private Notifier $notifier) {}

    /** Pending requests, oldest first, as in FamBank's "Pendientes de aprobación". */
    public function pending(Request $request): AnonymousResourceCollection
    {
        return MoneyRequestResource::collection(
            MoneyRequest::with('membership.user')->where('bank_id', $this->bank($request)->id)
                ->where('status', MoneyRequestStatus::Pending)->oldest()->get(),
        );
    }

    public function update(Request $request, MoneyRequest $moneyRequest): MoneyRequestResource
    {
        $this->own($request, $moneyRequest);
        $operation = $this->operations->update($moneyRequest, $request->user(), $request->validate(OperationRules::edit()));

        return new MoneyRequestResource($operation->load('membership.user'));
    }

    public function confirm(Request $request, MoneyRequest $moneyRequest): MoneyRequestResource
    {
        $this->own($request, $moneyRequest);
        $operation = $this->operations->confirm($moneyRequest, $request->user(), $request->validate(OperationRules::edit()));
        $this->notifier->requestResolved($operation);

        return new MoneyRequestResource($operation->load('membership.user'));
    }

    public function reject(Request $request, MoneyRequest $moneyRequest): MoneyRequestResource
    {
        $this->own($request, $moneyRequest);
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:255']]);
        $operation = $this->operations->reject($moneyRequest, $request->user(), $data['reason'] ?? null);
        $this->notifier->requestResolved($operation);

        return new MoneyRequestResource($operation->load('membership.user'));
    }

    public function changeDate(Request $request, MoneyRequest $moneyRequest): MoneyRequestResource
    {
        $this->own($request, $moneyRequest);
        $data = $request->validate(['occurred_at' => ['required', ...OperationRules::date()]]);
        $operation = $this->operations->changeDate($moneyRequest, $request->user(), $data['occurred_at']);
        $this->notifier->dateChanged($operation);

        return new MoneyRequestResource($operation->load('membership.user'));
    }

    private function bank(Request $request): Bank
    {
        return $request->attributes->get('bank');
    }

    private function own(Request $request, MoneyRequest $moneyRequest): void
    {
        abort_unless($moneyRequest->bank_id === $this->bank($request)->id, 404);
    }
}
