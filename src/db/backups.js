/**
 * Politique de conservation des sauvegardes automatiques — fonction pure,
 * indépendante d'IndexedDB (testable sous Node, voir test/smoke.mjs).
 *
 * Une sauvegarde est créée à chaque ouverture : garder simplement les N plus
 * récentes ferait disparaître la veille dès qu'on ouvre l'app souvent pendant
 * un salon. On conserve donc :
 * - les KEEP_RECENT dernières ouvertures (quel que soit le jour) ;
 * - la plus récente de chacun des KEEP_DAYS derniers jours ayant une sauvegarde.
 */
export const KEEP_RECENT = 5
export const KEEP_DAYS = 14

// 'viticole-2026-07-25-14-30-00' → '2026-07-25' (préfixe quelconque accepté)
const KEY_RE = /^[a-z]+-(\d{4}-\d{2}-\d{2})-\d{2}-\d{2}-\d{2}$/

/** Retourne les clés à supprimer. Les clés au format inconnu ne sont jamais supprimées. */
export function backupsToDelete(keys, keepRecent = KEEP_RECENT, keepDays = KEEP_DAYS) {
  const dated = keys
    .map(key => ({ key, day: key.match(KEY_RE)?.[1] }))
    .filter(b => b.day)
    // Tri chronologique sur la partie date (indépendant du préfixe), récent d'abord
    .sort((a, b) => b.key.slice(-19).localeCompare(a.key.slice(-19)))

  const keep = new Set(dated.slice(0, keepRecent).map(b => b.key))
  const days = new Set()
  for (const b of dated) {
    if (days.has(b.day)) continue
    if (days.size >= keepDays) break
    days.add(b.day)
    keep.add(b.key)
  }
  return dated.filter(b => !keep.has(b.key)).map(b => b.key)
}
