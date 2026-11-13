import { isPlainObject, readKey, transact } from '../../lib/db'
import { applyLevelChange, CRITTER_LEVELS_KEY, sanitizeCritterLevels, unknownLevelEntries, type CritterLevels } from './levels'
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

export async function loadCritterLevels(): Promise<CritterLevels> {
  return sanitizeCritterLevels(await readKey(CRITTER_LEVELS_KEY))
}

/**
 * Règle le niveau d'UN compagnon (`null` l'efface), dans UNE transaction qui lit `critters` (l'animal
 * est-il obtenu ?) et `critterLevels`, puis n'écrit QUE `critterLevels` : `critters` n'est jamais réécrit
 * par cette opération. Si l'animal a été décoché dans un autre onglet entre-temps, l'opération est refusée.
 * Les entrées inconnues de cette version (animaux d'une version plus récente) sont conservées. Renvoie l'état enregistré.
 */
export function updateCritterLevel(id: string, level: number | null): Promise<CritterLevels> {
  return transact({ keys: [CRITTERS_KEY, CRITTER_LEVELS_KEY] }, (values) => {
    const obtained = sanitizeCritters(values[CRITTERS_KEY]).progress[id]?.obtained === true
    const raw = values[CRITTER_LEVELS_KEY]
    const next = applyLevelChange(sanitizeCritterLevels(raw), obtained, id, level)
    return { ops: { set: [[CRITTER_LEVELS_KEY, { ...unknownLevelEntries(raw), ...next }]] }, result: next }
  })
}
