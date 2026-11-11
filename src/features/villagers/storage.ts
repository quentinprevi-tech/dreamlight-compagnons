import { CHARACTERS_BY_ID, isCharacterId, isReleased } from '../../data/characters'
import { isPlainObject, readKey, transact } from '../../lib/db'
import { ASSIGNMENTS_KEY, sanitizeAssignments } from '../../lib/storage'
import { applyPatch, isValidPatch, sanitizeVillagers, VILLAGERS_KEY, type VillagerPatch, type Villagers } from './model'

export async function loadVillagers(): Promise<Villagers> {
  return sanitizeVillagers(await readKey(VILLAGERS_KEY))
}

export class VillagerError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VillagerError'
  }
}

/**
 * Modifie UN habitant par lecture-modification-écriture atomique : seuls les champs
 * du `patch` changent, le reste (autres habitants, autres champs) est relu dans la
 * même transaction. Deux onglets ne peuvent donc pas s'écraser.
 * Renvoie l'état enregistré.
 */
export function updateVillager(id: string, patch: VillagerPatch): Promise<Villagers> {
  if (!isCharacterId(id) || !isValidPatch(patch)) return Promise.reject(new VillagerError('Habitant ou valeur inconnus.'))
  if (patch.unlocked && !isReleased(CHARACTERS_BY_ID[id])) {
    return Promise.reject(new VillagerError('Cet habitant n’est pas encore sorti.'))
  }
  return transact({ keys: [VILLAGERS_KEY, ASSIGNMENTS_KEY] }, (values) => {
    if (patch.unlocked === false && Object.hasOwn(sanitizeAssignments(values[ASSIGNMENTS_KEY]), id)) {
      throw new VillagerError('Un habitant qui a un métier est forcément débloqué : retire d’abord son métier.')
    }
    const all: Record<string, unknown> = isPlainObject(values[VILLAGERS_KEY]) ? { ...values[VILLAGERS_KEY] } : {}
    const entry = applyPatch(all[id], patch)
    if (Object.keys(entry).length) all[id] = entry
    else delete all[id]
    return { ops: { set: [[VILLAGERS_KEY, all]] }, result: sanitizeVillagers(all) }
  })
}
