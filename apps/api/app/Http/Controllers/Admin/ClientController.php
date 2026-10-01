<?php

namespace App\Http\Controllers\Admin;

use App\Enums\InvitationType;
use App\Enums\MembershipStatus;
use App\Enums\MoneyRequestStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\MoneyRequestResource;
use App\Models\Bank;
use App\Models\BankMembership;
use App\Models\Invitation;
use App\Models\MoneyRequest;
use App\Services\ClientManagement;
use App\Services\Notifier;
use App\Services\Operations;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rules\Password;

class ClientController extends Controller
{
    public function __construct(private ClientManagement $clients) {}

    public function index(Request $request): JsonResponse
    {
        $bank = $this->bank($request);
        $pending = MoneyRequest::where('bank_id', $bank->id)->where('status', MoneyRequestStatus::Pending)
            ->selectRaw('bank_membership_id, count(*) as total')->groupBy('bank_membership_id')->pluck('total', 'bank_membership_id');

        $clients = $bank->memberships()->with(['user', 'savingsAccount'])->get()
            ->sortBy(fn ($m) => [$m->status === MembershipStatus::Active ? 0 : 1, mb_strtolower($m->user->name)])
            ->values()
            ->map(fn (BankMembership $m) => $this->presentClient($m, (int) ($pending[$m->id] ?? 0)));

        $invitations = $bank->invitations()
            ->where('type', InvitationType::BankClient)->whereNull('accepted_at')->whereNull('revoked_at')
            ->latest('id')->get()
            ->map(fn (Invitation $i) => $this->presentInvitation($i));

        return response()->json(['data' => ['clients' => $clients, 'invitations' => $invitations]]);
    }

    public function invite(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email:rfc', 'max:255'],
            'name' => ['required', 'string', 'max:120'],
        ]);

        return $this->invitationResponse($this->clients->invite($this->bank($request), $data['email'], $data['name'], $request->user()), 201);
    }

    public function resendInvitation(Request $request, Invitation $invitation): JsonResponse
    {
        $this->ownInvitation($request, $invitation);

        return $this->invitationResponse($this->clients->resend($invitation, $request->user()), 200);
    }

    public function revokeInvitation(Request $request, Invitation $invitation): JsonResponse
    {
        $this->ownInvitation($request, $invitation);
        $this->clients->revoke($invitation);

        return response()->json(null, 204);
    }

    public function update(Request $request, BankMembership $membership): JsonResponse
    {
        $this->own($request, $membership);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email:rfc', 'max:255'],
        ]);

        $this->clients->update($membership, $data['name'], $data['email']);

        return response()->json(['data' => $this->presentClient($membership->fresh(['user', 'savingsAccount']))]);
    }

    public function setPassword(Request $request, BankMembership $membership): JsonResponse
    {
        $this->own($request, $membership);
        $data = $request->validate(['password' => ['required', 'confirmed', Password::min(8)]]);
        $this->clients->setPassword($membership, $data['password']);

        return response()->json(['message' => 'Contraseña actualizada. Tiene que volver a ingresar.']);
    }

    public function sendPasswordReset(Request $request, BankMembership $membership): JsonResponse
    {
        $this->own($request, $membership);
        $this->clients->sendPasswordReset($membership);

        return response()->json(['message' => 'Le enviamos un link para restablecer la contraseña.']);
    }

    public function deactivate(Request $request, BankMembership $membership): JsonResponse
    {
        $this->own($request, $membership);

        return response()->json(['data' => $this->presentClient($this->clients->deactivate($membership)->load(['user', 'savingsAccount']))]);
    }

    public function reactivate(Request $request, BankMembership $membership): JsonResponse
    {
        $this->own($request, $membership);

        return response()->json(['data' => $this->presentClient($this->clients->reactivate($membership)->load(['user', 'savingsAccount']))]);
    }

    /** Full history of a client: every request with what was asked and what was confirmed. */
    public function operations(Request $request, BankMembership $membership): AnonymousResourceCollection
    {
        $this->own($request, $membership);

        return MoneyRequestResource::collection(
            MoneyRequest::with('membership.user')->where('bank_membership_id', $membership->id)
                ->orderByRaw('coalesce(occurred_at, created_at) desc')->paginate(30),
        );
    }

    /** Records an operation that already happened; it is confirmed at once. */
    public function record(Request $request, BankMembership $membership, Operations $operations, Notifier $notifier): JsonResponse
    {
        $this->own($request, $membership);
        $data = $request->validate(OperationRules::create(withRate: true));

        $operation = $operations->record($membership, $request->user(), $data);
        $notifier->operationRecorded($operation);

        return response()->json(['data' => new MoneyRequestResource($operation->load('membership.user'))], 201);
    }

    private function presentClient(BankMembership $membership, ?int $pendingRequests = null): array
    {
        $account = $membership->savingsAccount;

        return [
            'membership_id' => $membership->id,
            'name' => $membership->user->name,
            'email' => $membership->user->email,
            'status' => $membership->status->value,
            'member_since' => $membership->created_at,
            'last_seen_at' => $membership->user->last_seen_at,
            'balance_usd' => (string) ($account?->balance_usd ?? '0.00'),
            'reserved_usd' => (string) ($account?->reserved_usd ?? '0.00'),
            'available_usd' => $account ? $account->availableUsd() : '0.00',
            'pending_requests' => $pendingRequests ?? MoneyRequest::where('bank_membership_id', $membership->id)->where('status', MoneyRequestStatus::Pending)->count(),
            // The administrator may edit identity and password only for people who use no other bank.
            'manageable' => $this->clients->managedOnlyHere($membership, $membership->user),
        ];
    }

    private function presentInvitation(Invitation $invitation): array
    {
        return [
            'id' => $invitation->id,
            'email' => $invitation->email,
            'name' => $invitation->name,
            'state' => $invitation->state(),
            'expires_at' => $invitation->expires_at,
            'last_sent_at' => $invitation->last_sent_at,
        ];
    }

    private function invitationResponse(array $result, int $status): JsonResponse
    {
        return response()->json([
            'data' => $this->presentInvitation($result['invitation']),
            'email_sent' => $result['email_sent'],
            'invitation_url' => config('multifambank.expose_invitation_links') ? $result['accept_url'] : null,
        ], $status);
    }

    private function bank(Request $request): Bank
    {
        return $request->attributes->get('bank');
    }

    private function own(Request $request, BankMembership $membership): void
    {
        abort_unless($membership->bank_id === $this->bank($request)->id, 404);
    }

    private function ownInvitation(Request $request, Invitation $invitation): void
    {
        abort_unless($invitation->bank_id === $this->bank($request)->id && $invitation->type === InvitationType::BankClient, 404);
    }
}
