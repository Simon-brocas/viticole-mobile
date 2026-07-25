import { useState, useEffect, useContext } from 'react'
import { SalonCtx } from '../App'
import { api } from '../api'

export default function Caisse() {
  const { salon } = useContext(SalonCtx)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), montant_initial: '' })
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => { load() }, [salon.id])

  const load = async () => {
    setLoading(true)
    setError('')
    try { setRows(await api.getCaisse(salon.id)) }
    catch { setError('Erreur de chargement de la caisse.') }
    finally { setLoading(false) }
  }

  const submit = async e => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.setCaisse(salon.id, { date: form.date, montant_initial: parseFloat(form.montant_initial) || 0 })
      setShowForm(false)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const totalEspeces = rows.reduce((s, r) => s + r.especes_encaissees, 0)

  if (loading) return <div className="text-center py-12 text-gray-400">Chargement…</div>

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-800">Fond de caisse</h2>
        <button onClick={() => setShowForm(true)} className="btn-primary py-2 px-3 text-sm">
          + Ajouter jour
        </button>
      </div>

      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>
      )}

      {/* Récap global espèces */}
      {rows.length > 0 && (
        <div className="card bg-green-50 border-green-200">
          <div className="text-xs text-green-700 font-medium mb-1">Total espèces encaissées</div>
          <div className="text-3xl font-bold text-green-700">{totalEspeces.toFixed(2)} €</div>
        </div>
      )}

      {/* Formulaire ajout jour */}
      {showForm && (
        <form onSubmit={submit} className="card space-y-3">
          <h3 className="font-semibold">Nouveau jour</h3>
          <div>
            <label className="text-xs font-medium text-gray-600">Date</label>
            <input type="date" className="input mt-1" value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Fond de caisse initial (€)</label>
            <input type="number" inputMode="decimal" step="0.01" min="0" className="input mt-1"
              placeholder="Ex : 150.00"
              value={form.montant_initial}
              onChange={e => setForm(f => ({ ...f, montant_initial: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">
              Annuler
            </button>
          </div>
        </form>
      )}

      {/* Tableau journalier */}
      {rows.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <div className="text-4xl mb-2">💰</div>
          <p>Aucun jour saisi</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.id} className="card">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-800">
                  {new Date(r.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="text-xs text-gray-500">Fond initial</div>
                  <div className="font-semibold">{r.montant_initial.toFixed(2)} €</div>
                </div>
                <div className="bg-green-50 rounded-lg p-2">
                  <div className="text-xs text-green-600">Encaissé</div>
                  <div className="font-semibold text-green-700">+ {r.especes_encaissees.toFixed(2)} €</div>
                </div>
                <div className="bg-forest-50 rounded-lg p-2 border border-forest-200">
                  <div className="text-xs text-forest-700">Solde caisse</div>
                  <div className="font-bold text-forest-700">{r.solde.toFixed(2)} €</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
