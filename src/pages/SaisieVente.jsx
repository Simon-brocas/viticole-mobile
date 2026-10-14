import { useState, useEffect, useContext } from 'react'
import { SalonCtx } from '../App'
import { api } from '../api'
import { round2, calculerRemises, normaliserRemise } from '../db/operations'
import { suggestionsEspeces } from '../utils/especes'
import { lireBrouillon, ecrireBrouillon, reconcilierPanier, BROUILLON_VIDE } from '../utils/panier'
import { Sheet } from '../components/Modal'
import RemiseInput, { remiseSaisie, evaluerRemise } from '../components/RemiseInput'
import Recu from '../components/Recu'
import { libelleRemise } from '../utils/recu'
import {
  niveauStock, categoriesDe, filtrerProduits, alertesFranchies, messageAlertes,
  SANS_CATEGORIE, STOCK_BAS,
} from '../utils/stock'
import {
  IconSearch, IconCart, IconBox, IconTag, IconCheck, IconX, IconPlus, IconMinus,
  IconCash, IconCard, IconCheque, IconSplit, IconReceipt, IconAlert,
} from '../components/Icons'

const TYPES = [
  { key: 'normal', label: 'Vente', color: 'bg-forest-500 text-white' },
  { key: 'degustation', label: 'Dégustation', color: 'bg-amber-500 text-white' },
  { key: 'offert', label: 'Offert', color: 'bg-purple-500 text-white' },
]

const PAYS = [
  { key: 'Especes', label: 'Espèces', Icon: IconCash },
  { key: 'CB', label: 'CB', Icon: IconCard },
  { key: 'Cheque', label: 'Chèque', Icon: IconCheque },
]
const MIXTE_FIELDS = [
  { key: 'especes', label: 'Espèces', Icon: IconCash },
  { key: 'cb', label: 'CB', Icon: IconCard },
  { key: 'cheque', label: 'Chèque', Icon: IconCheque },
]

const hasCarton = p => p.carton_taille && p.carton_prix != null

const itemPrix = item => item.unite === 'carton' ? item.produit.carton_prix : item.produit.prix
const itemTotal = item => item.type === 'normal' ? round2(itemPrix(item) * item.quantite) : 0
// Unités décomptées du stock (même règle que validateItem côté métier)
const itemUnites = item => item.unite === 'carton' ? item.quantite * item.produit.carton_taille : item.quantite

export default function SaisieVente() {
  const { salon } = useContext(SalonCtx)
  const [produits, setProduits] = useState([])
  // Panier et paiement en cours repris du brouillon (changement d'onglet, rechargement)
  const [brouillon] = useState(() => lireBrouillon(salon.id))
  const [panier, setPanier] = useState(brouillon.panier)
  const [modal, setModal] = useState(null)
  const [modePaiement, setModePaiement] = useState(brouillon.modePaiement)
  const [espClient, setEspClient] = useState(brouillon.espClient)
  const [mixte, setMixte] = useState(brouillon.mixte)
  const [remiseTicket, setRemiseTicket] = useState(brouillon.remiseTicket)
  const [dernierTicket, setDernierTicket] = useState(null) // { id, numero } du ticket validé
  const [recu, setRecu] = useState(null)                  // id du ticket affiché
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [flash, setFlash] = useState('')
  const [flashError, setFlashError] = useState('')
  const [search, setSearch] = useState('')
  // Filtre de la grille (catégorie / stock bas), mémorisé par salon sur l'appareil
  const [filtre, setFiltre] = useState(() => {
    try { return localStorage.getItem(`filtre:${salon.id}`) || '' } catch { return '' }
  })
  const [alerteStock, setAlerteStock] = useState('') // articles passés sous leur seuil

  useEffect(() => { loadProduits() }, [salon.id])

  useEffect(() => {
    ecrireBrouillon(salon.id, { panier, modePaiement, espClient, mixte, remiseTicket })
  }, [salon.id, panier, modePaiement, espClient, mixte, remiseTicket])

  const loadProduits = async () => {
    try {
      const data = await api.getSalonProduits(salon.id)
      const selection = data.filter(p => p.selectionne)
      setProduits(selection)
      // Prix et stocks à jour pour les lignes reprises du brouillon
      setPanier(p => reconcilierPanier(p, selection))
    } catch {
      setFlashError('Erreur de chargement des produits.')
    } finally {
      setLoading(false)
    }
  }

  const showError = msg => {
    setFlashError(msg)
    setTimeout(() => setFlashError(''), 4000)
  }

  // Stock encore disponible pour un article, déduction faite de ce qui est déjà au panier
  const disponible = p => p.stock_restant - panier
    .filter(i => i.produit.produit_id === p.produit_id)
    .reduce((s, i) => s + itemUnites(i), 0)

  const { categories, sansCategorie } = categoriesDe(produits)
  const nbStockBas = produits.filter(p => niveauStock(disponible(p), p.seuil_alerte) !== 'ok').length
  // Chips proposés : catégories, « Sans catégorie » s'il y en a d'autres, « Stock bas » s'il y en a
  const chips = [
    ...categories.map(c => ({ key: c, label: c })),
    ...(sansCategorie && categories.length > 0 ? [{ key: SANS_CATEGORIE, label: 'Sans catégorie' }] : []),
    ...(nbStockBas > 0 ? [{ key: STOCK_BAS, label: `Stock bas (${nbStockBas})`, alerte: true }] : []),
  ]
  // Filtre mémorisé devenu sans objet (catégorie supprimée, plus de stock bas) : tout afficher
  const filtreActif = chips.some(c => c.key === filtre) ? filtre : ''
  const choisirFiltre = key => {
    setFiltre(key)
    try { localStorage.setItem(`filtre:${salon.id}`, key) } catch { /* non bloquant */ }
  }

  const filtered = filtrerProduits(produits, filtreActif, disponible).filter(p =>
    p.nom.toLowerCase().includes(search.toLowerCase())
  )

  const openModal = p => setModal({ produit: p, type: 'normal', unite: 'bouteille', quantite: 1, remise: null })

  // Remise uniquement sur une vente : changer de type la retire
  const setType = type => setModal(m => ({ ...m, type, unite: 'bouteille', quantite: type === 'degustation' ? 0.5 : 1, remise: null }))
  const setUnite = unite => setModal(m => ({ ...m, unite, quantite: 1 }))

  const step = m => m.type === 'degustation' ? 0.5 : 1
  const stepQuantite = dir => setModal(m => {
    const s = step(m)
    const q = parseFloat((m.quantite + dir * s).toFixed(1))
    return { ...m, quantite: Math.max(s, q) }
  })

  const addToPanier = () => {
    if (!modal || modalTrop || modalRemise.erreur) return
    setPanier(p => [...p, { ...modal, remise: remiseSaisie(modal.remise) ? modal.remise : null, key: Date.now() }])
    setModal(null)
    setDernierTicket(null)
  }

  const removeFromPanier = key => setPanier(p => p.filter(i => i.key !== key))

  const viderPanier = () => {
    setPanier(BROUILLON_VIDE.panier)
    setEspClient(BROUILLON_VIDE.espClient)
    setMixte(BROUILLON_VIDE.mixte)
    setRemiseTicket(BROUILLON_VIDE.remiseTicket)
  }

  // Remises : même calcul que l'enregistrement (operations.calculerRemises).
  // Arrondi au centime : 3 × 9.90 donnerait 29.700000000000003 et refuserait 29.70 €
  let calc = null
  let calcErreur = ''
  try {
    calc = calculerRemises(panier.map(i => ({
      type_quantite: i.type, prix_unitaire: itemPrix(i), quantite: i.quantite,
      remise: normaliserRemise(remiseSaisie(i.remise)),
    })), normaliserRemise(remiseSaisie(remiseTicket)))
  } catch (e) {
    calcErreur = e.message
  }
  const totalPanier = calc ? calc.total : round2(panier.reduce((s, i) => s + itemTotal(i), 0))
  const sousTotal = calc ? calc.sous_total : totalPanier

  const totalMixte = round2((parseFloat(mixte.especes) || 0) + (parseFloat(mixte.cb) || 0) + (parseFloat(mixte.cheque) || 0))
  // > 0 : reste à répartir, < 0 : trop-perçu
  const ecartMixte = round2(totalPanier - totalMixte)

  const espRemis = round2(parseFloat(espClient) || 0)
  const renduMonnaie = modePaiement === 'Especes' && espClient !== ''
    ? Math.max(0, round2(espRemis - totalPanier))
    : null

  const modalRemise = modal ? evaluerRemise(modal.remise, itemTotal(modal)) : { montant: 0, erreur: '' }
  const modalDispo = modal ? disponible(modal.produit) : 0
  const modalTrop = modal ? itemUnites(modal) > modalDispo + 1e-9 : false
  const modalPlusBloque = modal
    ? itemUnites({ ...modal, quantite: modal.quantite + step(modal) }) > modalDispo + 1e-9
    : false

  const showPayment = panier.some(i => i.type === 'normal')

  const valider = async () => {
    if (panier.length === 0 || sending) return
    if (calcErreur) {
      showError(calcErreur)
      return
    }

    if (showPayment) {
      if (modePaiement === 'Especes') {
        if (espClient === '') {
          showError('Veuillez saisir le montant remis par le client.')
          return
        }
        if (espRemis < totalPanier) {
          showError(`Montant insuffisant. Il manque ${(totalPanier - espRemis).toFixed(2)} €`)
          return
        }
      }
      if (modePaiement === 'Mixte' && Math.abs(ecartMixte) > 0.01) {
        showError(`Le total des paiements (${totalMixte.toFixed(2)} €) ne correspond pas au total (${totalPanier.toFixed(2)} €)`)
        return
      }
    }

    // Unités vendues par article, pour signaler les seuils franchis après la vente
    const vendus = {}
    for (const i of panier) vendus[i.produit.produit_id] = (vendus[i.produit.produit_id] || 0) + itemUnites(i)

    setSending(true)
    setAlerteStock('')
    try {
      const res = await api.validerPanier(salon.id, {
        items: panier.map(i => ({
          produit_id: i.produit.produit_id,
          type_quantite: i.type,
          unite: i.unite,
          quantite: i.quantite,
          remise: remiseSaisie(i.remise),
          sync_id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        })),
        remise: showPayment ? remiseSaisie(remiseTicket) : null,
        mode_paiement: showPayment ? modePaiement : null,
        ...(modePaiement === 'Especes' && espClient !== '' ? { montant_remis: parseFloat(espClient) } : {}),
        ...(modePaiement === 'Mixte' ? {
          montant_especes: parseFloat(mixte.especes) || 0,
          montant_cb: parseFloat(mixte.cb) || 0,
          montant_cheque: parseFloat(mixte.cheque) || 0,
        } : {}),
      })
      viderPanier()
      setFlash(res.ticket ? `Ticket n°${res.ticket.numero} enregistré` : 'Vente enregistrée')
      setTimeout(() => setFlash(''), 2500)
      if (res.ticket) setDernierTicket(res.ticket)
      setAlerteStock(messageAlertes(alertesFranchies(produits, vendus)))
      await loadProduits()
    } catch (e) {
      showError(e.message || 'Erreur lors de l\'enregistrement.')
    } finally {
      setSending(false)
    }
  }

  if (loading) return <div className="text-center py-12 text-gray-400">Chargement…</div>

  return (
    <div className="p-3 space-y-3">
      <div aria-live="polite">
        {flash && (
          <div className="fixed top-16 left-0 right-0 mx-4 bg-gray-800 text-white py-3 rounded-xl z-50
                          font-medium shadow-lg flex items-center justify-center gap-2">
            <IconCheck size={18} className="text-green-400" />
            {flash}
          </div>
        )}
      </div>
      <div aria-live="assertive">
        {flashError && (
          <div className="fixed top-16 left-0 right-0 mx-4 bg-red-600 text-white text-center py-3 rounded-xl z-50 font-medium shadow-lg">
            {flashError}
          </div>
        )}
      </div>

      {/* Recherche article */}
      <div className="relative">
        <IconSearch size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          className="input pl-10"
          type="search"
          aria-label="Rechercher un article"
          placeholder="Rechercher un article…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Filtres : catégories et stock bas */}
      {chips.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto -mx-3 px-3 pb-0.5 [scrollbar-width:none]"
          role="group" aria-label="Filtrer les articles">
          {[{ key: '', label: 'Tous' }, ...chips].map(c => (
            <button key={c.key || 'tous'} onClick={() => choisirFiltre(c.key)} aria-pressed={filtreActif === c.key}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors whitespace-nowrap
                ${filtreActif === c.key
                  ? (c.alerte ? 'bg-orange-500 text-white border-orange-500' : 'bg-forest-500 text-white border-forest-500')
                  : (c.alerte ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-white text-gray-600 border-gray-200')}`}>
              {c.label}
            </button>
          ))}
        </div>
      )}

      {/* Seuil d'alerte franchi par la dernière vente */}
      {alerteStock && (
        <div role="status" className="flex items-start gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5 text-sm text-orange-800">
          <IconAlert size={18} className="shrink-0 mt-0.5 text-orange-500" />
          <span className="flex-1">{alerteStock}</span>
          <button onClick={() => setAlerteStock('')} aria-label="Fermer l'alerte" className="text-orange-400 p-0.5">
            <IconX size={16} />
          </button>
        </div>
      )}

      {/* Dernier ticket validé : accès au reçu jusqu'au prochain ajout */}
      {dernierTicket && panier.length === 0 && (
        <div className="card py-2.5 flex items-center justify-between gap-2 bg-forest-50 border-forest-100">
          <span className="text-sm font-medium text-forest-800">Ticket n°{dernierTicket.numero} enregistré</span>
          <button onClick={() => setRecu(dernierTicket.id)}
            className="btn-secondary py-1.5 px-3 text-sm inline-flex items-center gap-1.5">
            <IconReceipt size={16} />Reçu
          </button>
        </div>
      )}

      {/* Grille produits */}
      {filtered.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <IconBox size={40} className="mx-auto mb-2 text-gray-300" />
          {produits.length === 0 ? (
            <>
              <p className="font-medium">Aucun article sélectionné</p>
              <p className="text-xs mt-1 text-gray-400">Admin → Salon pour configurer</p>
            </>
          ) : (
            <p className="font-medium">Aucun article ne correspond</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {filtered.map(p => {
            const dispo = disponible(p)
            const ratio = p.stock_initial > 0 ? dispo / p.stock_initial : 1
            const niveau = niveauStock(dispo, p.seuil_alerte)
            const stockWarn = niveau === 'bas'
            const stockOut = niveau === 'epuise'
            return (
              <button key={p.produit_id} onClick={() => openModal(p)} disabled={stockOut}
                aria-label={stockOut ? `${p.nom} — épuisé` : undefined}
                className="bg-white rounded-2xl border border-gray-100 shadow-card p-3 text-left
                           active:scale-[0.97] active:shadow-none transition-all duration-150
                           hover:border-forest-200 hover:shadow-card-hover
                           disabled:opacity-50 disabled:active:scale-100 disabled:hover:border-gray-100">
                {!!p.has_photo && (
                  <img src={api.photoUrl('produits', p.produit_id, p.photo_updated)} alt=""
                    className="w-full h-24 object-cover rounded-xl mb-2" loading="lazy" />
                )}
                <div className="font-semibold text-sm text-gray-900 leading-snug mb-2">{p.nom}</div>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-forest-600 font-bold text-base">{p.prix.toFixed(2)} €</div>
                    {hasCarton(p) && (
                      <div className="text-[11px] text-gray-500 font-medium flex items-center gap-1">
                        <IconBox size={12} className="text-gray-400" />
                        ×{p.carton_taille} : {p.carton_prix.toFixed(2)} €
                      </div>
                    )}
                  </div>
                  <div className={`text-xs font-bold px-1.5 py-0.5 rounded-lg
                    ${stockOut ? 'bg-red-100 text-red-600' : stockWarn ? 'bg-orange-100 text-orange-600' : 'bg-forest-50 text-forest-600'}`}>
                    {stockOut ? 'Épuisé' : dispo}
                  </div>
                </div>
                <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all
                    ${stockOut ? 'bg-red-400' : stockWarn ? 'bg-orange-400' : 'bg-forest-400'}`}
                    style={{ width: `${Math.max(0, Math.min(100, ratio * 100))}%` }} />
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Panier */}
      {panier.length > 0 && (
        <div className="card space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <IconCart size={18} className="text-forest-500" />
              Panier
            </h3>
            <button onClick={viderPanier}
              className="text-xs text-gray-400 hover:text-red-500 underline py-1 px-1">
              Vider
            </button>
          </div>
          {panier.map((item, k) => (
            <div key={item.key} className="flex items-center justify-between py-1 border-b border-gray-100 last:border-0">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{item.produit.nom}</div>
                <div className="text-xs text-gray-500 flex items-center gap-1 flex-wrap">
                  <span className={`badge ${TYPES.find(t => t.key === item.type)?.color}`}>
                    {TYPES.find(t => t.key === item.type)?.label}
                  </span>
                  {item.unite === 'carton'
                    ? <span>{item.quantite} carton{item.quantite > 1 ? 's' : ''} de {item.produit.carton_taille}</span>
                    : <span>× {item.quantite}</span>}
                  {remiseSaisie(item.remise) && (
                    <span className="badge bg-rose-100 text-rose-700">{libelleRemise(remiseSaisie(item.remise))}</span>
                  )}
                </div>
              </div>
              <div className="text-right ml-2 flex items-center gap-2">
                {item.type === 'normal' && (
                  calc && calc.lignes[k].remise_ligne > 0 ? (
                    <div className="text-sm leading-tight">
                      <div className="text-[11px] text-gray-400 line-through">{itemTotal(item).toFixed(2)} €</div>
                      <div className="font-semibold">{(calc.lignes[k].brut - calc.lignes[k].remise_ligne).toFixed(2)} €</div>
                    </div>
                  ) : (
                    <div className="font-semibold text-sm">{itemTotal(item).toFixed(2)} €</div>
                  )
                )}
                <button onClick={() => removeFromPanier(item.key)}
                  aria-label={`Retirer ${item.produit.nom} du panier`}
                  className="text-gray-300 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors">
                  <IconX size={16} strokeWidth={2.2} />
                </button>
              </div>
            </div>
          ))}

          {showPayment && (
            <div className="pt-2 space-y-3">
              {/* Mode de paiement */}
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1">Mode de paiement</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {PAYS.map(({ key, label, Icon }) => (
                    <button key={key} onClick={() => { setModePaiement(key); setMixte({ especes: '', cb: '', cheque: '' }) }}
                      className={`flex flex-col items-center gap-1 py-2 text-xs rounded-xl font-medium border transition-colors
                        ${modePaiement === key
                          ? 'bg-forest-500 text-white border-forest-500'
                          : 'border-gray-200 text-gray-600 hover:border-forest-200'}`}>
                      <Icon size={18} />
                      {label}
                    </button>
                  ))}
                  <button onClick={() => { setModePaiement('Mixte'); setEspClient('') }}
                    className={`flex flex-col items-center gap-1 py-2 text-xs rounded-xl font-medium border transition-colors
                      ${modePaiement === 'Mixte'
                        ? 'bg-forest-500 text-white border-forest-500'
                        : 'border-gray-200 text-gray-600 hover:border-forest-200'}`}>
                    <IconSplit size={18} />
                    Mixte
                  </button>
                </div>
              </div>

              {/* Total + paiement */}
              <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                {/* Remise sur tout le ticket */}
                {remiseTicket ? (
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Sous-total</span>
                      <span>{sousTotal.toFixed(2)} €</span>
                    </div>
                    <p className="text-xs font-medium text-gray-600">Remise sur le ticket</p>
                    <RemiseInput id="remise-ticket" value={remiseTicket} onChange={setRemiseTicket}
                      base={sousTotal} quoi="du ticket" />
                  </div>
                ) : (
                  <button type="button" onClick={() => setRemiseTicket({ type: 'pct', valeur: '' })}
                    className="text-sm text-rose-600 font-medium inline-flex items-center gap-1 py-1">
                    <IconPlus size={14} strokeWidth={2.4} />
                    Remise sur le ticket
                  </button>
                )}
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span className="text-forest-600">{totalPanier.toFixed(2)} €</span>
                </div>
                {calc && (calc.remise_lignes > 0 || calc.remise_ticket > 0) && (
                  <p className="text-xs text-rose-600 text-right -mt-1.5">
                    dont {(calc.remise_lignes + calc.remise_ticket).toFixed(2)} € de remises
                  </p>
                )}

                {modePaiement === 'Especes' && (
                  <>
                    <div className="flex items-center gap-2">
                      <label htmlFor="esp-client" className="text-sm text-gray-600 whitespace-nowrap">Espèces client</label>
                      <div className="relative flex-1">
                        <input
                          id="esp-client"
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          className="input text-right pr-8"
                          placeholder="0.00"
                          value={espClient}
                          onChange={e => setEspClient(e.target.value)}
                        />
                        <span className="absolute right-3 top-3 text-gray-400 text-sm">€</span>
                      </div>
                    </div>
                    {/* Montants rapides : exact, puis arrondis / billets supérieurs */}
                    <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Montants rapides">
                      {[{ v: totalPanier, label: 'Exact' }, ...suggestionsEspeces(totalPanier).map(v => ({ v, label: `${v} €` }))]
                        .map(({ v, label }) => {
                          const actif = espClient !== '' && Math.abs(espRemis - v) < 0.005
                          return (
                            <button key={label} type="button" onClick={() => setEspClient(v.toFixed(2))}
                              aria-pressed={actif}
                              className={`py-2 rounded-xl text-sm font-semibold border transition-colors
                                ${actif
                                  ? 'bg-forest-500 text-white border-forest-500'
                                  : 'bg-white border-gray-200 text-gray-700 active:bg-gray-100'}`}>
                              {label}
                            </button>
                          )
                        })}
                    </div>
                    {renduMonnaie !== null && (
                      <div className="flex justify-between font-bold text-base rounded-lg px-2 py-1 bg-green-50 text-green-700">
                        <span>Rendu monnaie</span>
                        <span>{renduMonnaie.toFixed(2)} €</span>
                      </div>
                    )}
                  </>
                )}

                {modePaiement === 'Mixte' && (
                  <div className="space-y-2">
                    {MIXTE_FIELDS.map(({ key, label, Icon }) => (
                      <div key={key} className="flex items-center gap-2">
                        <label htmlFor={`mixte-${key}`}
                          className="text-sm text-gray-600 w-28 shrink-0 flex items-center gap-1.5">
                          <Icon size={15} className="text-gray-400" />
                          {label}
                        </label>
                        <div className="relative flex-1">
                          <input
                            id={`mixte-${key}`}
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            className="input text-right pr-8"
                            placeholder="0.00"
                            value={mixte[key]}
                            onChange={e => setMixte(m => ({ ...m, [key]: e.target.value }))}
                          />
                          <span className="absolute right-3 top-3 text-gray-400 text-sm">€</span>
                        </div>
                      </div>
                    ))}
                    <div className={`flex justify-between text-sm font-semibold rounded-lg px-2 py-1
                      ${Math.abs(ecartMixte) < 0.01 ? 'bg-green-50 text-green-700'
                        : ecartMixte > 0 ? 'bg-orange-50 text-orange-600' : 'bg-red-50 text-red-600'}`}>
                      <span>{ecartMixte < -0.005 ? 'Trop-perçu' : 'Reste à répartir'}</span>
                      <span>{Math.abs(ecartMixte).toFixed(2)} €</span>
                    </div>
                  </div>
                )}
              </div>

              <button onClick={valider} disabled={sending}
                className="btn-primary w-full text-base">
                {sending ? 'Enregistrement…' : 'Valider la vente'}
              </button>
            </div>
          )}

          {!showPayment && (
            <button onClick={valider} disabled={sending}
              className="btn-primary w-full text-base mt-2">
              {sending ? 'Enregistrement…' : 'Valider la vente'}
            </button>
          )}
        </div>
      )}

      {/* Modal ajout produit */}
      {modal && (
        <Sheet onClose={() => setModal(null)} className="max-h-[92vh] overflow-y-auto">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              {!!modal.produit.has_photo && (
                <img src={api.photoUrl('produits', modal.produit.produit_id, modal.produit.photo_updated)} alt=""
                  className="w-14 h-14 rounded-xl object-cover shrink-0" />
              )}
              <div>
                <h3 className="font-bold text-gray-900">{modal.produit.nom}</h3>
                <p className="text-forest-600 font-semibold">
                  {modal.unite === 'carton'
                    ? `${modal.produit.carton_prix.toFixed(2)} € le carton de ${modal.produit.carton_taille}`
                    : `${modal.produit.prix.toFixed(2)} €`}
                </p>
              </div>
            </div>
            <button onClick={() => setModal(null)} aria-label="Fermer"
              className="text-gray-400 text-2xl leading-none p-1">&times;</button>
          </div>

          {/* Type */}
          <div>
            <p className="text-sm font-medium text-gray-600 mb-2">Type</p>
            <div className="flex gap-2">
              {TYPES.map(t => (
                <button key={t.key} onClick={() => setType(t.key)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors
                    ${modal.type === t.key ? t.color + ' border-transparent' : 'border-gray-200 text-gray-600'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Unité (si le produit a un carton, vente normale uniquement) */}
          {modal.type === 'normal' && hasCarton(modal.produit) && (
            <div>
              <p className="text-sm font-medium text-gray-600 mb-2">Unité</p>
              <div className="flex gap-2">
                {/* 'bouteille' est la valeur historique en base ; l'étiquette affichée est neutre */}
                <button onClick={() => setUnite('bouteille')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium border transition-colors
                    ${modal.unite === 'bouteille' ? 'bg-forest-500 text-white border-transparent' : 'border-gray-200 text-gray-600'}`}>
                  <IconTag size={15} />
                  Unité — {modal.produit.prix.toFixed(2)} €
                </button>
                <button onClick={() => setUnite('carton')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium border transition-colors
                    ${modal.unite === 'carton' ? 'bg-forest-500 text-white border-transparent' : 'border-gray-200 text-gray-600'}`}>
                  <IconBox size={15} />
                  Carton de {modal.produit.carton_taille} — {modal.produit.carton_prix.toFixed(2)} €
                </button>
              </div>
            </div>
          )}

          {/* Quantité */}
          <div>
            <p className="text-sm font-medium text-gray-600 mb-2">
              Quantité{modal.unite === 'carton' ? ' (cartons)' : ''}
            </p>
            <div className="flex items-center gap-4">
              <button onClick={() => stepQuantite(-1)} aria-label="Diminuer la quantité"
                className="w-12 h-12 rounded-xl bg-gray-100 text-gray-600 active:bg-gray-200
                           flex items-center justify-center transition-colors">
                <IconMinus size={22} strokeWidth={2.4} />
              </button>
              <span className="text-3xl font-bold text-gray-900 w-16 text-center">{modal.quantite}</span>
              <button onClick={() => stepQuantite(1)} aria-label="Augmenter la quantité"
                disabled={modalPlusBloque}
                className="w-12 h-12 rounded-xl bg-gray-100 text-gray-600 active:bg-gray-200
                           flex items-center justify-center transition-colors disabled:opacity-40">
                <IconPlus size={22} strokeWidth={2.4} />
              </button>
              {modal.type === 'normal' && (
                <span className="text-lg font-semibold text-forest-600 ml-2">
                  = {round2(itemTotal(modal) - modalRemise.montant).toFixed(2)} €
                </span>
              )}
            </div>
            {modal.unite === 'carton' && (
              <p className="text-xs text-gray-500 mt-1">
                Décompte du stock : {modal.quantite * modal.produit.carton_taille} unités
              </p>
            )}
            {modal.type !== 'normal' && (
              <p className="text-xs text-gray-500 mt-1">
                {modal.type === 'degustation' ? 'Nombre d\'unités ouvertes (par 0,5)' : 'Nombre d\'unités offertes'}
              </p>
            )}
          </div>

          {modal.type === 'normal' && (
            <div>
              <p className="text-sm font-medium text-gray-600 mb-2">Remise</p>
              <RemiseInput id="remise-ligne" value={modal.remise}
                onChange={remise => setModal(m => ({ ...m, remise }))} base={itemTotal(modal)} />
            </div>
          )}

          {modalTrop && (
            <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              Stock insuffisant : {modalDispo > 0 ? `${modalDispo} unité${modalDispo > 1 ? 's' : ''} disponible${modalDispo > 1 ? 's' : ''}` : 'plus aucune unité disponible'}
              {panier.some(i => i.produit.produit_id === modal.produit.produit_id) ? ' (panier déduit)' : ''}.
            </p>
          )}

          <button onClick={addToPanier} disabled={modalTrop || !!modalRemise.erreur} className="btn-primary w-full text-base">
            Ajouter au panier
          </button>
        </Sheet>
      )}

      {recu && (
        <Recu salonId={salon.id} ticketId={recu} onClose={() => setRecu(null)}
          onAnnule={() => { setDernierTicket(null); loadProduits() }} />
      )}
    </div>
  )
}
