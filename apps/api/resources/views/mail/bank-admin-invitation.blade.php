<x-mail::message>
# Hola, {{ $name }}

Te invitaron a administrar un banco familiar en **MultiFamBank**.

Para aceptar, confirmá tu email, definí tu contraseña (o ingresá con la que ya tenés) y completá los datos de tu banco.

<x-mail::button :url="$acceptUrl">
Aceptar invitación
</x-mail::button>

La invitación vence el {{ $expiresAt }} (hora de Argentina) y se puede usar una sola vez.

Si no esperabas este email, podés ignorarlo.

Saludos,<br>
MultiFamBank
</x-mail::message>
