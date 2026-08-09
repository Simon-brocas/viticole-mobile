import { useState, useRef, useEffect, useCallback } from 'react'

/**
 * Menu déroulant accessible : se ferme au clic extérieur, à Échap et après
 * activation d'un élément ; le focus revient sur le déclencheur.
 *
 * trigger : ({ open, toggle, ref }) => JSX du bouton déclencheur
 */
export function DropdownMenu({ trigger, children, align = 'left', className = '' }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const triggerRef = useRef(null)
  const panelRef = useRef(null)

  const close = useCallback((refocus = true) => {
    setOpen(false)
    if (refocus) triggerRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close() } }
    const onPointer = e => { if (!wrapRef.current?.contains(e.target)) close(false) }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointer)
    // Focus le premier élément pour la navigation clavier
    panelRef.current?.querySelector('[role="menuitem"]')?.focus()
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointer)
    }
  }, [open, close])

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      {trigger({ open, toggle: () => setOpen(o => !o), ref: triggerRef })}
      {open && (
        <div ref={panelRef} role="menu"
          onClick={() => close(false)}
          className={`absolute top-full mt-1.5 z-50 min-w-[13rem] p-1
                      bg-white rounded-2xl border border-gray-100 shadow-modal
                      origin-top animate-menu
                      ${align === 'right' ? 'right-0' : 'left-0'}`}>
          {children}
        </div>
      )}
    </div>
  )
}

export function MenuItem({ icon, children, onClick, danger = false }) {
  return (
    <button role="menuitem" onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium
                  text-left transition-colors
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-400
                  ${danger
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-gray-700 hover:bg-gray-50'}`}>
      {icon && <span className={danger ? 'text-red-400' : 'text-gray-400'}>{icon}</span>}
      {children}
    </button>
  )
}

export function MenuSeparator() {
  return <div className="my-1 h-px bg-gray-100" role="separator" />
}
