import { isPlainObject, readKey, transact } from '../../lib/db'
import { applyCritterOp, CRITTERS_KEY, sanitizeCritters, type CritterOp, type CrittersData } from './model'

export async function loadCritters(): Promise<CrittersData> {
  return sanitizeCritters(await readKey(CRITTERS_KEY))
}

/**
 * Applique UNE opération par lecture-modification-écriture atomique : l'état est relu dans
 * la transaction, jamais réenregistré depuis la mémoire. Deux onglets (ou deux appuis rapides)
 * ne peuvent donc pas compter deux nourrissages le même jour. Renvoie l'état enregistré.
 */
export function updateCritters(op: CritterOp, now: Date = new Date()): Promise<CrittersData> {
  return transact({ keys: [CRITTERS_KEY] }, (values) => {
    const raw = values[CRITTERS_KEY]
    const next = applyCritterOp(sanitizeCritters(raw), op, now)
    // Les champs inconnus de cette version (écrits par une version plus récente) sont gardés.
    const stored = { ...(isPlainObject(raw) ? raw : {}), ...next }
    return { ops: { set: [[CRITTERS_KEY, stored]] }, result: next }
  })
}
