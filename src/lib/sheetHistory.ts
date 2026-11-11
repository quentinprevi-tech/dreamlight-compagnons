/**
 * Bouton « Retour » et fiches : une fiche ouverte doit se fermer avec « Retour » (Android, geste iOS, touche
 * Précédent d'un navigateur) sans quitter l'écran qu'elle recouvre.
 *
 * Principe : tant qu'au moins une fiche est ouverte, l'historique du navigateur contient des entrées « fiche »
 * en plus de celle de l'écran. Ces entrées ont la MÊME adresse que l'écran (aucun `hashchange`, le routeur ne
 * bouge pas) et portent un compteur dans leur `state` : `{ ddvSheets: n }` = « n fiches ouvertes ».
 *
 *   écran (pas d'état)  →  fiche 1 ({ ddvSheets: 1 })  →  fiche 2 ({ ddvSheets: 2 })
 *
 * Une seule règle, appliquée à chaque changement (`reconcile`) : l'historique doit contenir EXACTEMENT autant
 * d'entrées « fiche » que de fiches ouvertes.
 *   - il en manque  → `pushState` ;
 *   - il y en a trop → `history.go(-n)`.
 * Les trois origines d'une fermeture suivent donc le même chemin, sans cas particulier :
 *   - « Retour » : le navigateur retire l'entrée (`popstate`) → on ferme les fiches en trop ;
 *   - croix, glissement, clic à côté, Échap, bouton de la fiche : la fiche se démonte → il y a une entrée en trop → on la retire ;
 *   - navigation vers un autre écran pendant qu'une fiche est ouverte, rechargement de la page, bouton « Suivant » :
 *     on retombe sur une entrée « fiche » sans fiche ouverte (entrée orpheline) → on la retire aussitôt.
 *
 * Deux protections contre les courses :
 *   - `reconcile` est différé d'un micro-tâche : un écran qui remplace une fiche par une autre dans le même rendu
 *     (recette → renommage) ne provoque ni retrait ni ajout ;
 *   - `history.go` est asynchrone : tant qu'un retrait demandé par nous n'est pas terminé (`pending`), on n'ajoute rien.
 *
 * Si le navigateur refuse (SecurityError de `pushState`, Safari au-delà de 100 appels en 30 s), le mécanisme se
 * désactive et les fiches fonctionnent comme avant (croix, glissement, Échap, clic à côté).
 */

interface Entry {
  id: symbol
  /** Ferme la fiche côté parent (son `onClose`) */
  close: () => void
}

const STATE_KEY = 'ddvSheets'
/** Si `popstate` n'arrive jamais après un `history.go`, on ne reste pas bloqué. */
const PENDING_TIMEOUT_MS = 1000

// Minuteries réelles, captées à l'import : les tests qui simulent le temps ne doivent pas figer ce module.
const realSetTimeout = globalThis.setTimeout.bind(globalThis)
const realClearTimeout = globalThis.clearTimeout.bind(globalThis)

const open: Entry[] = []
let pending = false
let pendingTimer: ReturnType<typeof setTimeout> | undefined
let scheduled = false
let broken = false
let waiters: (() => void)[] = []

/** Nombre d'entrées « fiche » au sommet de l'historique (0 sur une entrée ordinaire). */
function depth(): number {
  const state: unknown = window.history.state
  if (typeof state !== 'object' || state === null || !(STATE_KEY in state)) return 0
  const n = (state as Record<string, unknown>)[STATE_KEY]
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : 0
}

function notifyIdle() {
  if (pending || scheduled) return
  const done = waiters
  waiters = []
  for (const w of done) w()
}

function reconcile() {
  scheduled = false
  if (broken || pending) return notifyIdle()
  const want = open.length
  const have = depth()
  try {
    if (want > have) {
      for (let n = have + 1; n <= want; n++) window.history.pushState({ [STATE_KEY]: n }, '')
    } else if (want < have) {
      pending = true
      pendingTimer = realSetTimeout(() => {
        pending = false
        schedule()
      }, PENDING_TIMEOUT_MS)
      window.history.go(-(have - want))
      return
    }
  } catch {
    broken = true
    pending = false
  }
  notifyIdle()
}

function schedule() {
  if (scheduled) return
  scheduled = true
  queueMicrotask(reconcile)
}

function onPopState() {
  if (pending) {
    // Fin d'un retrait demandé par nous
    pending = false
    realClearTimeout(pendingTimer)
    return schedule()
  }
  // « Retour » (ou « Suivant ») de la personne : plus d'entrées que de fiches ouvertes = fermer celles du dessus.
  const excess = open.length - depth()
  for (let i = 0; i < excess; i++) open[open.length - 1 - i]?.close()
  // Les fiches fermées se démonteront et replanifieront ; si l'une refuse (opération en cours), l'entrée est remise.
  schedule()
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', onPopState)
  // Entrée « fiche » héritée d'un rechargement ou d'une session précédente : aucune fiche n'est ouverte, on la retire.
  schedule()
}

/** Déclare une fiche ouverte. Renvoie la fonction à appeler à sa fermeture (démontage). */
export function registerSheet(close: () => void): () => void {
  const entry: Entry = { id: Symbol('sheet'), close }
  open.push(entry)
  schedule()
  return () => {
    const at = open.indexOf(entry)
    if (at >= 0) open.splice(at, 1)
    schedule()
  }
}

/** Pour les tests : résout quand l'historique est de nouveau cohérent avec les fiches ouvertes (ou après 2 s). */
export function sheetHistorySettled(): Promise<void> {
  if (!pending && !scheduled) return Promise.resolve()
  return new Promise((resolve) => {
    const timer = realSetTimeout(resolve, 2000)
    waiters.push(() => {
      realClearTimeout(timer)
      resolve()
    })
  })
}

/** Pour les tests : repart d'un état vierge (aucune fiche, aucun retrait en cours, mécanisme actif). */
export function resetSheetHistoryForTests() {
  open.length = 0
  pending = false
  scheduled = false
  broken = false
  realClearTimeout(pendingTimer)
}
