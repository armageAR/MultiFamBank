import { useEffect, useId, useRef, type ReactNode } from 'react'
import { useLook } from './look'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
}

/** Native <dialog>: focus trapping, Escape to close and an inert background come from the browser. */
export function Modal({ title, onClose, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const pressedOnBackdrop = useRef(false)
  const family = useLook() === 'family'

  // No close() on cleanup: it would fire onClose during StrictMode's remount, and an unmounted
  // dialog leaves the page anyway.
  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  // Closing through close() lets the browser return focus to the element that opened the dialog;
  // the resulting "close" event then calls onClose.
  const requestClose = () => ref.current?.close()

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      // Only a press and release both on the backdrop closes it, so dragging out of a field does not.
      onPointerDown={(event) => {
        pressedOnBackdrop.current = event.target === ref.current
      }}
      onClick={(event) => {
        if (pressedOnBackdrop.current && event.target === ref.current) requestClose()
        pressedOnBackdrop.current = false
      }}
      className={
        family
          ? // FamBank: a sheet from the bottom on phones, centered card on larger screens.
            'mx-auto mt-auto mb-0 max-h-[92dvh] w-full max-w-lg rounded-t-2xl border border-gray-100 bg-white p-0 text-gray-900 shadow-xl backdrop:bg-black/40 backdrop:backdrop-blur-sm sm:m-auto sm:max-h-[90dvh] sm:w-[min(32rem,calc(100%-2rem))] sm:rounded-2xl'
          : 'm-auto w-[min(48rem,calc(100%-2rem))] max-w-none rounded-xl bg-slate-50 p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/50'
      }
    >
      <div
        className={`sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-white px-5 py-4 ${family ? 'border-gray-100' : 'border-slate-200'}`}
      >
        <h2 id={titleId} className={family ? 'text-sm font-semibold text-gray-900' : 'text-lg font-semibold'}>
          {title}
        </h2>
        <button
          type="button"
          onClick={requestClose}
          aria-label="Cerrar"
          className={`rounded-lg p-1 focus-visible:outline-2 ${family ? 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-emerald-500' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-brand-600'}`}
        >
          <svg viewBox="0 0 20 20" className="size-5" aria-hidden fill="currentColor">
            <path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" />
          </svg>
        </button>
      </div>
      <div className={family ? 'flex flex-col gap-4 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]' : 'space-y-4 p-5'}>{children}</div>
    </dialog>
  )
}
