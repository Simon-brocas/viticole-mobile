import { useEffect } from 'react'

export function useEscape(onClose) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
}

/* Panneau coulissant depuis le bas (saisie, édition) */
export function Sheet({ onClose, children, className = '', label }) {
  useEscape(onClose)
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={onClose}
      role="dialog" aria-modal="true" aria-label={label}>
      <div className={`bg-white rounded-t-2xl w-full max-w-lg mx-auto p-5 space-y-4 ${className}`}
        onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

/* Confirmation centrée pour les actions destructives */
export function ConfirmModal({ title, message, confirmLabel = 'Supprimer', onConfirm, onCancel }) {
  useEscape(onCancel)
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-3">
        <h3 className="font-bold text-gray-800">{title}</h3>
        {message && <p className="text-sm text-gray-500">{message}</p>}
        <div className="flex gap-2">
          <button onClick={onConfirm} className="btn-danger flex-1">{confirmLabel}</button>
          <button onClick={onCancel} className="btn-secondary flex-1">Annuler</button>
        </div>
      </div>
    </div>
  )
}
