<x-mail::message>
# Hola, {{ $name }}

Te invitaron a ser cliente de **{{ $bankName }}** en MultiFamBank: vas a poder ver tus ahorros y pedir dinero desde la app.

Para aceptar, confirmá tu email y definí tu contraseña (o ingresá con la que ya tenés si sos cliente de otro banco).

<x-mail::button :url="$acceptUrl">
Aceptar invitación
</x-mail::button>

La invitación vence el {{ $expiresAt }} y se puede usar una sola vez.

Si no esperabas este email, podés ignorarlo.

Saludos,<br>
MultiFamBank
</x-mail::message>
