import { isPlainObject, readKey, transact } from '../../lib/db'
import { applyTaleOp, sanitizeTales, TALES_KEY, type TaleOp, type TalesData } from './model'

export async function loadTales(): Promise<TalesData> {
  return sanitizeTales(await readKey(TALES_KEY))
}

/**
 * Applique UNE opération par lecture-modification-écriture atomique : les compteurs sont relus dans la
 * transaction, jamais réenregistrés depuis la mémoire. Conséquences :
 * - deux onglets qui ajoutent des anigamis en même temps conservent les deux ajouts ;
 * - une validation vérifie les quantités sur les compteurs RÉELS : si un autre onglet vient de les
 *   dépenser, elle échoue sans rien écrire (jamais de compteur négatif) ;
 * - l'annulation rend exactement ce qui avait été déduit aux compteurs actuels.
 * Renvoie l'état enregistré.
 */
export function updateTales(op: TaleOp, now: Date = new Date()): Promise<TalesData> {
  return transact({ keys: [TALES_KEY] }, (values) => {
    const raw = values[TALES_KEY]
    const next = applyTaleOp(sanitizeTales(raw), op, now)
    // Les champs inconnus de cette version (écrits par une version plus récente) sont gardés.
    const stored = { ...(isPlainObject(raw) ? raw : {}), ...next }
    return { ops: { set: [[TALES_KEY, stored]] }, result: next }
  })
}
