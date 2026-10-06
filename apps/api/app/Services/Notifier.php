<?php

namespace App\Services;

use App\Enums\MoneyRequestStatus;
use App\Enums\MoneyRequestType;
use App\Models\MoneyRequest;
use App\Models\User;

use function Illuminate\Support\defer;

/** Who hears about what. Messages are sent after the HTTP response so they never slow it down. */
class Notifier
{
    public function __construct(private PushNotifications $push) {}

    /** A client asked for something: tell the bank administrator. */
    public function requestCreated(MoneyRequest $request): void
    {
        $request->loadMissing('bank.admin', 'membership.user');
        $admin = $request->bank->admin;

        if (! $admin) {
            return;
        }

        $this->later($admin, [
            'title' => 'Nuevo pedido',
            'body' => "{$request->membership->user->name} pide {$this->what($request)}".($request->description ? ": {$request->description}" : ''),
            'url' => config('multifambank.urls.admin').'/?pedido='.$request->id,
            'tag' => 'request-'.$request->id,
        ]);
    }

    /** Confirmed or rejected: tell the client, mentioning changes the administrator made. */
    public function requestResolved(MoneyRequest $request): void
    {
        $request->loadMissing('membership.user');
        $confirmed = $request->status === MoneyRequestStatus::Confirmed;
        $changed = $request->requested_type !== $request->type
            || bccomp((string) $request->requested_amount_ars, (string) $request->amount_ars, 2) !== 0;

        $this->later($request->membership->user, [
            'title' => $confirmed ? 'Pedido confirmado' : 'Pedido rechazado',
            'body' => ($confirmed ? 'Se confirmó ' : 'Se rechazó ').$this->what($request)
                .($confirmed && $changed ? ' (con cambios del administrador)' : '')
                .(! $confirmed && $request->rejection_reason ? ": {$request->rejection_reason}" : '.'),
            'url' => $this->clientUrl($request),
            'tag' => 'request-'.$request->id,
        ]);
    }

    public function operationRecorded(MoneyRequest $request): void
    {
        $request->loadMissing('membership.user');

        $this->later($request->membership->user, [
            'title' => 'Nueva operación',
            'body' => 'El administrador registró '.$this->what($request).'.',
            'url' => $this->clientUrl($request),
            'tag' => 'request-'.$request->id,
        ]);
    }

    public function dateChanged(MoneyRequest $request): void
    {
        $request->loadMissing('membership.user', 'bank');

        $this->later($request->membership->user, [
            'title' => 'Fecha de operación modificada',
            'body' => 'La fecha de '.$this->what($request).' ahora es el '.$request->occurred_at->timezone($request->bank->timezone)->format('d/m/Y').'.',
            'url' => $this->clientUrl($request),
            'tag' => 'request-'.$request->id,
        ]);
    }

    public function amountChanged(MoneyRequest $request): void
    {
        $request->loadMissing('membership.user');

        $this->later($request->membership->user, [
            'title' => 'Importe de operación modificado',
            'body' => 'El administrador corrigió el importe: ahora es '.$this->what($request).'.',
            'url' => $this->clientUrl($request),
            'tag' => 'request-'.$request->id,
        ]);
    }

    /** The operation no longer exists, so the link opens the bank only. */
    public function operationDeleted(MoneyRequest $request): void
    {
        $request->loadMissing('membership.user');

        $this->later($request->membership->user, [
            'title' => 'Operación eliminada',
            'body' => 'El administrador eliminó '.$this->what($request).'.',
            'url' => config('multifambank.urls.client').'/?'.http_build_query(['banco' => $request->bank_id]),
            'tag' => 'request-'.$request->id,
        ]);
    }

    /** Opens the client app on the operation's bank, with the operation highlighted. */
    private function clientUrl(MoneyRequest $request): string
    {
        return config('multifambank.urls.client').'/?'.http_build_query(['banco' => $request->bank_id, 'operacion' => $request->id]);
    }

    private function what(MoneyRequest $request): string
    {
        $amount = '$ '.number_format((float) $request->amount_ars, 0, ',', '.');

        return match ($request->type) {
            MoneyRequestType::SavingsDeposit => "un depósito de $amount",
            MoneyRequestType::SavingsWithdrawal => "un retiro de $amount",
            MoneyRequestType::Expense => "un gasto de $amount",
        };
    }

    private function later(User $user, array $message): void
    {
        $push = $this->push;
        defer(fn () => $push->sendQuietly($user, $message));
    }
}
