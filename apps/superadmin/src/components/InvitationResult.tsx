import type { CreateBankResponse } from '@multifambank/api-client'
import { Alert, Button } from '@multifambank/ui'
import { useState } from 'react'

/** Outcome of issuing an administrator invitation, with the shareable link while email is not configured. */
export function InvitationResult({ result, title }: { result: CreateBankResponse; title: string }) {
  const [copied, setCopied] = useState(false)
  const { admin } = result.data

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="space-y-3">
      {result.invitation_url ? (
        <Alert tone="success" title={title}>
          La invitación para <strong>{admin.email}</strong> está lista.
        </Alert>
      ) : result.email_sent ? (
        <Alert tone="success" title={title}>
          Enviamos la invitación a <strong>{admin.email}</strong>.
        </Alert>
      ) : (
        <Alert tone="warning" title={`${title}, pero el email no se envió`}>
          Hubo un problema al enviar la invitación a <strong>{admin.email}</strong>. Podés reenviarla desde el listado.
        </Alert>
      )}

      {result.invitation_url && (
        <div className="space-y-2">
          <p className="text-sm text-slate-700">
            El envío de emails todavía no está configurado en este entorno, así que no se mandó ningún email. Compartí este link con{' '}
            {admin.name ?? 'el administrador'}; se puede usar una sola vez.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-slate-100 px-3 py-2 text-xs whitespace-nowrap">
              {result.invitation_url}
            </code>
            <Button variant="secondary" onClick={() => copy(result.invitation_url!)}>
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
