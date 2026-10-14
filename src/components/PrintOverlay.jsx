import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useEscape } from './Modal'
import { IconX, IconCheck } from './Icons'

/**
 * Écran plein page imprimable (Z de caisse, reçu) : pendant l'impression,
 * seul le contenu marqué .print-zone sort sur la page (voir index.css).
 */
export default function PrintOverlay({ title, onClose, children }) {
  useEscape(onClose)
  useEffect(() => {
    document.body.classList.add('print-open')
    return () => document.body.classList.remove('print-open')
  }, [])

  return createPortal(
    <div className="print-overlay fixed inset-0 z-50 bg-gray-50 overflow-y-auto"
      role="dialog" aria-modal="true" aria-label={title}>
      <div className="max-w-lg mx-auto px-3 space-y-3
                      pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div className="no-print flex items-center justify-between">
          <h2 className="font-bold text-lg text-gray-900">{title}</h2>
          <button onClick={onClose} aria-label="Fermer"
            className="p-2 rounded-xl text-gray-500 hover:bg-gray-100">
            <IconX size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  )
}

/** Message bref (« copié ») affiché dans un écran imprimable. */
export function useFlash() {
  const [flash, setFlash] = useState('')
  const show = msg => {
    setFlash(msg)
    setTimeout(() => setFlash(''), 2500)
  }
  const node = (
    <div aria-live="polite" className="no-print">
      {flash && (
        <div className="bg-gray-800 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2">
          <IconCheck size={18} className="text-green-400" />
          {flash}
        </div>
      )}
    </div>
  )
  return [show, node]
}

/**
 * Partage un texte : feuille de partage du téléphone, sinon presse-papiers.
 * Retourne 'shared', 'copied' ou 'cancelled' ; lève une erreur si rien n'est possible.
 */
export async function partagerTexte(title, text) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text })
      return 'shared'
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelled'
    }
  }
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    throw new Error('Partage indisponible sur cet appareil : utilisez « Imprimer / PDF ».')
  }
}
