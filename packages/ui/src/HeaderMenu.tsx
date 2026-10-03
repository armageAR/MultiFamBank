import { useEffect, useId, useRef, useState } from 'react'

export interface HeaderMenuItem {
  label: string
  onSelect: () => void
  tone?: 'danger'
}

/** "☰" button in the header that opens a short list of actions; the last one is usually "Salir". */
export function HeaderMenu({ items, label = 'Menú' }: { items: HeaderMenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)
  const listId = useId()

  // Closes on a click outside or Escape (returning focus to the button).
  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        toggle.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={root} className="relative">
      <button
        ref={toggle}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
        className="flex size-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="size-5" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      {open && (
        <ul id={listId} className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-lg">
          {items.map((item) => (
            <li key={item.label}>
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  item.onSelect()
                }}
                className={`block w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-gray-50 ${item.tone === 'danger' ? 'border-t border-gray-100 text-red-600' : 'text-gray-700'}`}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
