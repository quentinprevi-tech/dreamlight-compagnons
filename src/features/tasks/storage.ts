import { isPlainObject, readKey, transact } from '../../lib/db'
import { applyTaskOp, sanitizeTasks, TASKS_KEY, type TaskOp, type TasksData } from './model'

export async function loadTasks(): Promise<TasksData> {
  return sanitizeTasks(await readKey(TASKS_KEY))
}

/**
 * Applique UNE opération par lecture-modification-écriture atomique : l'état est relu
 * dans la transaction, jamais réenregistré depuis la mémoire. Deux onglets qui cochent
 * deux tâches en même temps conservent donc les deux. Renvoie l'état enregistré.
 */
export function updateTasks(op: TaskOp, now: Date = new Date()): Promise<TasksData> {
  return transact({ keys: [TASKS_KEY] }, (values) => {
    const raw = values[TASKS_KEY]
    const next = applyTaskOp(sanitizeTasks(raw), op, now)
    // Les champs inconnus de cette version (écrits par une version plus récente) sont gardés.
    const stored = { ...(isPlainObject(raw) ? raw : {}), ...next }
    return { ops: { set: [[TASKS_KEY, stored]] }, result: next }
  })
}
