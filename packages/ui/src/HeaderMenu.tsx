import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

export interface HeaderMenuItem {
  label: string
  onSelect: () => void
  tone?: 'danger'
}

const menuIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="size-5" aria-hidden="true">
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
)

const gearIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="size-[18px]" aria-hidden="true">
    <path d="M10.3 4.32c.43-1.76 2.93-1.76 3.36 0a1.72 1.72 0 0 0 2.57 1.06c1.54-.94 3.31.83 2.37 2.37a1.72 1.72 0 0 0 1.07 2.57c1.75.43 1.75 2.93 0 3.36a1.72 1.72 0 0 0-1.07 2.57c.94 1.54-.83 3.31-2.37 2.37a1.72 1.72 0 0 0-2.57 1.07c-.43 1.75-2.93 1.75-3.36 0a1.72 1.72 0 0 0-2.57-1.07c-1.54.94-3.31-.83-2.37-2.37a1.72 1.72 0 0 0-1.06-2.57c-1.76-.43-1.76-2.93 0-3.36a1.72 1.72 0 0 0 1.06-2.57c-.94-1.54.83-3.31 2.37-2.37 1 .61 2.3.07 2.57-1.06z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

interface ActionMenuProps {
  items: HeaderMenuItem[]
  /** Accessible name of the button. */
  label: string
  icon: ReactNode
  /** Where the list opens: below the button, or above it for buttons near the bottom of a list. */
  placement?: 'below' | 'above'
  buttonClassName: string
}

/** A button that opens a short list of actions. */
function ActionMenu({ items, label, icon, placement = 'below', buttonClassName }: ActionMenuProps) {
  const [open, setOpen] = useState(false)
  // A list meant to open upwards opens downwards when the button is too close to the top of the screen.
  const [up, setUp] = useState(false)
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
        // Inside a <dialog>, Escape would also close it: only the menu closes.
        event.preventDefault()
        event.stopPropagation()
        setOpen(false)
        toggle.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey, true)
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
        onClick={() => {
          setUp(placement === 'above' && (toggle.current?.getBoundingClientRect().top ?? 0) > 200)
          setOpen((value) => !value)
        }}
        className={buttonClassName}
      >
        {icon}
      </button>
      {open && (
        <ul
          id={listId}
          className={`absolute right-0 z-20 w-56 overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-lg ${up ? 'bottom-full mb-2' : 'mt-2'}`}
        >
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

/** "☰" button in the header that opens a short list of actions; the last one is usually "Salir". */
export function HeaderMenu({ items, label = 'Menú' }: { items: HeaderMenuItem[]; label?: string }) {
  return (
    <ActionMenu
      items={items}
      label={label}
      icon={menuIcon}
      buttonClassName="flex size-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900"
    />
  )
}

/** Small gear at the corner of a list row that opens the row's actions (opens upwards). */
export function RowMenu({ items, label }: { items: HeaderMenuItem[]; label: string }) {
  return (
    <ActionMenu
      items={items}
      label={label}
      icon={gearIcon}
      placement="above"
      buttonClassName="-m-1.5 flex size-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-emerald-500"
    />
  )
}
