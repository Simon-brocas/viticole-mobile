import { useState, useEffect, useContext } from 'react'
import { SalonCtx } from '../App'
import { api } from '../api'
import { Sheet } from '../components/Modal'

export default function Stocks() {
  const { salon } = useContext(SalonCtx)
  const [produits, setProduits] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [salon.id])

  const load = async () => {
    setLoading(true)
    setError('')
    try { setProduits(await api.getSalonProduits(salon.id)) }
    catch { setError('Erreur de chargement des stocks.') }
    finally { setLoading(false) }
  }

  const selected = produits.filter(p => p.selectionne)
  const rest = produits.filter(p => !p.selectionne)

  const save = async () => {
    if (!editing) return
    if (editing.stock_restant < 0 || editing.stock_initial < 0) {
      setError('Le stock ne peut pas être négatif.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await api.updateSalonProduit(salon.id, editing.produit_id, editing)
      setEditing(null)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const toggle = async p => {
    try {
      await api.updateSalonProduit(salon.id, p.produit_id, { ...p, selectionne: p.selectionne ? 0 : 1 })
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  // Modifier le stock initial conserve le nombre de bouteilles déjà vendues :
  // le restant suit le même écart.
  const setInitial = value => setEditing(d => ({
    ...d,
    stock_initial: value,
    stock_restant: Math.round((d.stock_restant + (value - d.stock_initial)) * 2) / 2,
  }))

  const stockColor = n => {
    if (n <= 0) return 'text-red-600 font-bold'
    if (n <= 5) return 'text-orange-500 font-semibold'
    return 'text-gray-800'
  }

  if (loading) return <div className="text-center py-12 text-gray-400">Chargement…</div>

  return (
    <div className="p-3 space-y-3">
      <h2 className="font-bold text-gray-800">Stocks — {salon.nom}</h2>

      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
          {error}
        </div>
      )}

      {/* Produits sélectionnés */}
      {selected.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <p>Aucun produit sélectionné</p>
          <p className="text-xs mt-1">Activez des produits ci-dessous</p>
        </div>
      ) : (
        <div className="space-y-2">
          {selected.map(p => (
            <div key={p.produit_id} className="card">
              <div className="flex items-center justify-between">
                {!!p.has_photo && (
                  <img src={api.photoUrl('produits', p.produit_id, p.photo_updated)} alt=""
                    className="w-10 h-10 rounded-lg object-cover shrink-0 mr-3" loading="lazy" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{p.nom}</div>
                  <div className="text-xs text-gray-500">{p.prix?.toFixed(2)} €</div>
                </div>
                <div className="text-right ml-3">
                  <div className={`text-2xl font-bold ${stockColor(p.stock_restant)}`}>
                    {p.stock_restant}
                  </div>
                  <div className="text-xs text-gray-400">/ {p.stock_initial}</div>
                </div>
                <button onClick={() => setEditing({ ...p })}
                  className="ml-3 text-sm text-forest-600 underline whitespace-nowrap py-2">
                  Modifier
                </button>
              </div>
              {/* Barre de progression */}
              <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${p.stock_restant <= 0 ? 'bg-red-500' : p.stock_restant <= 5 ? 'bg-orange-400' : 'bg-forest-500'}`}
                  style={{ width: p.stock_initial > 0 ? `${Math.max(0, Math.min(100, (p.stock_restant / p.stock_initial) * 100))}%` : '0%' }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Produits non sélectionnés */}
      {rest.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-2">Produits non sélectionnés</h3>
          <div className="space-y-1">
            {rest.map(p => (
              <div key={p.produit_id} className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-gray-100">
                <div>
                  <span className="text-sm text-gray-600">{p.nom}</span>
                  <span className="text-xs text-gray-400 ml-2">{p.prix?.toFixed(2)} €</span>
                </div>
                <button onClick={() => toggle(p)} className="text-xs text-forest-600 underline py-2">
                  Activer
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal édition stock */}
      {editing && (
        <Sheet onClose={() => setEditing(null)}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900">Modifier le stock</h3>
            <button onClick={() => setEditing(null)} aria-label="Fermer"
              className="text-gray-400 text-2xl p-1">&times;</button>
          </div>
          <p className="text-sm text-gray-600">{editing.nom}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="stock-init" className="text-xs font-medium text-gray-600">Stock initial</label>
              <input id="stock-init" type="number" inputMode="decimal" min="0" step="0.5" className="input mt-1"
                value={editing.stock_initial}
                onChange={e => setInitial(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label htmlFor="stock-rest" className="text-xs font-medium text-gray-600">Stock restant</label>
              <input id="stock-rest" type="number" inputMode="decimal" min="0" step="0.5" className="input mt-1"
                value={editing.stock_restant}
                onChange={e => setEditing(d => ({ ...d, stock_restant: parseFloat(e.target.value) || 0 }))}
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Ajuster le stock initial décale le restant d'autant (les ventes déjà comptées sont préservées).
          </p>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="sel" checked={!!editing.selectionne}
              onChange={e => setEditing(d => ({ ...d, selectionne: e.target.checked ? 1 : 0 }))} />
            <label htmlFor="sel" className="text-sm text-gray-700">Sélectionné pour ce salon</label>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="btn-primary flex-1">
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button onClick={() => setEditing(null)} className="btn-secondary flex-1">Annuler</button>
          </div>
        </Sheet>
      )}
    </div>
  )
}
