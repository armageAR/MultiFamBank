import { requestOperation, toApiError, type ApiError, type OperationType } from '@multifambank/api-client'
import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { api } from '../../api'

export interface RequestDraft {
  type: OperationType
  amount_ars: string
  description: string | null
  /** The quote shown to the client; recorded only if it is still current on the server. */
  exchange_rate?: string | null
}

interface Options {
  bankId: number
  online: boolean
  /** Saves the request on this device to send it when there is a connection. */
  enqueue: (id: string, payload: Omit<RequestDraft, 'exchange_rate'>) => Promise<void>
  onSent: () => void
  onQueued: () => void
  /** The server refused the shown quote because it changed: refresh it. */
  onRateChanged: () => void
}

/**
 * Sends a request, or keeps it on the device when offline or when the connection drops. The id is
 * tied to what the server compares on a retry (type and amount): retrying reuses it, so a request
 * that was created but whose answer was lost comes back instead of being duplicated.
 */
export function useRequestSubmit({ bankId, online, enqueue, onSent, onQueued, onRateChanged }: Options) {
  const queryClient = useQueryClient()
  const attempt = useRef<{ content: string; id: string } | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit(draft: RequestDraft) {
    const content = `${draft.type}|${draft.amount_ars}`
    if (attempt.current?.content !== content) attempt.current = { content, id: crypto.randomUUID() }
    const { exchange_rate, ...queued } = draft

    setSubmitting(true)
    setError(null)
    try {
      if (!online) {
        // Offline the quote is fixed when the request is sent: the one on this device may be old.
        await enqueue(attempt.current.id, queued)
        return onQueued()
      }
      await requestOperation(api, bankId, { id: attempt.current.id, ...queued, exchange_rate })
      await queryClient.invalidateQueries({ queryKey: ['client'] })
      onSent()
    } catch (err) {
      const failure = toApiError(err)
      if (failure.status === undefined) {
        await enqueue(attempt.current.id, queued)
        return onQueued()
      }
      if (failure.fields.exchange_rate) onRateChanged()
      setError(failure)
    } finally {
      setSubmitting(false)
    }
  }

  return { submit, error, setError, submitting }
}
