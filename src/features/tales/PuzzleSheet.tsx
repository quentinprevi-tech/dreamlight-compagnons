import { BottomSheet } from '../../components/BottomSheet'
import type { CustomNames } from '../../lib/names'
import { ANIGAMI_BY_ID, ANIGAMI_TYPES, COST_STATUS_LABEL, CORRESPONDENCE_NOTE, TALES_SOURCES, TALES_VERIFIED_AT } from './data'
import { anigamiName, NAME_KIND_LABEL, taleName } from './display'
import type { PuzzleView, TalesData } from './model'
import { NameBadge } from './AnigamiRow'

export type PuzzleAction = 'validate' | 'mark' | 'undo' | 'reopen'

interface Props {
  view: PuzzleView
  data: TalesData
  names: CustomNames
  /** Sa validation est la dernière du journal et peut encore être annulée */
  undoable: boolean
  onAction: (action: PuzzleAction) => void
  onRename: () => void
  onClose: () => void
}

export const STATUS_LABEL = { done: 'Terminé', ready: 'Réalisable', missing: 'Il manque des anigamis', 'to-confirm': 'Coûts à confirmer' } as const
export const STATUS_STYLE = {
  done: 'bg-gold-200 text-plum-900',
  ready: 'bg-emerald-100 text-emerald-800',
  missing: 'bg-rose-100 text-rose-800',
  'to-confirm': 'bg-amber-100 text-amber-800',
} as const
export const STATUS_ICON = { done: '✅', ready: '🟢', missing: '🔸', 'to-confirm': '❔' } as const

const dayText = (iso: string) => new Date(iso).toLocaleDateString('fr-FR')
const CONFLICT_TEXT = 'Les sources se contredisent sur ce coût : l’app n’y déduit rien automatiquement. Tu peux marquer le puzzle terminé sans déduire.'

/** Détail d'un puzzle : coût par type d'anigami, manquants, état, actions (valider, marquer terminé, annuler). */
export function PuzzleSheet({ view, data, names, undoable, onAction, onRename, onClose }: Props) {
  const { tale, status, state } = view
  const name = taleName(tale, names)
  const action = 'w-full rounded-2xl px-4 py-3 text-left font-semibold transition active:scale-[0.98] disabled:opacity-50'
  const types = ANIGAMI_TYPES.filter((a) => Object.hasOwn(tale.cost, a.id))

  return (
    <BottomSheet
      onClose={onClose}
      labelledBy="puzzle-title"
      panelClassName="max-h-[90dvh] overflow-y-auto overscroll-contain bg-white px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
    >
      <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-plum-200" />
      <h2 id="puzzle-title" className="font-display text-2xl font-semibold text-plum-900">
        {name.text}
      </h2>
      <p className="text-sm text-plum-600">
        {tale.nameEn !== name.text && <>{tale.nameEn} · </>}
        {NAME_KIND_LABEL[name.kind === 'custom' ? 'custom' : 'to-confirm']}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button onClick={onRename} className="rounded-full bg-plum-100 px-3 py-1.5 text-sm font-semibold text-plum-800 active:scale-95">
          ✎ {names[`tale:${tale.id}`] ? 'Modifier mon nom' : 'Mon nom'}
        </button>
        <span className="text-sm font-semibold text-gold-500" aria-label={`${tale.stars} étoiles sur 5`}>
          {'★'.repeat(tale.stars)}
          <span className="text-plum-200">{'★'.repeat(5 - tale.stars)}</span>
        </span>
        <span data-testid="puzzle-status" className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[status]}`}>
          <span aria-hidden>{STATUS_ICON[status]}</span> {STATUS_LABEL[status]}
          {status === 'missing' && ` (${view.missingTotal})`}
        </span>
      </div>

      <p className="mt-3 text-sm text-plum-700">
        Récompense : <strong>{tale.reward}</strong> <span className="text-xs text-plum-500">(nom anglais)</span>
      </p>
      {tale.unlockQuest && (
        <p className="text-xs text-plum-500">
          Débloqué pendant la quête « {tale.unlockQuest} » <span>(nom anglais)</span>.
        </p>
      )}

      <section className="mt-4" aria-label="Coût du puzzle">
        <h3 className="font-semibold text-plum-800">Coût en anigamis</h3>
        <ul className="mt-1 space-y-1.5" aria-label="Coût par type d’anigami">
          {types.map((a) => {
            const need = tale.cost[a.id]
            const have = data.counts[a.id] ?? 0
            const missing = Math.max(0, need - have)
            const n = anigamiName(a, names)
            return (
              <li key={a.id} className={`rounded-2xl p-2.5 text-sm ${a.origin === 'quest' ? 'bg-indigo-50 ring-1 ring-indigo-300/70' : 'bg-plum-50'}`} data-testid={`cost-${a.id}`}>
                <span className="font-semibold text-plum-900">
                  {n.text}
                  <NameBadge name={n} />
                </span>
                <span className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-plum-700">
                  <span>Nécessaires : <strong>{need}</strong></span>
                  <span>Possédés : <strong>{have}</strong></span>
                  {state ? null : missing > 0 ? <strong className="text-rose-700">Manquent : {missing}</strong> : <span className="font-semibold text-emerald-700">Suffisants ✓</span>}
                </span>
                {ANIGAMI_BY_ID[a.id].origin === 'quest' && <span className="block text-xs font-semibold text-indigo-700">📜 Objet de quête (pas capturable au filet)</span>}
              </li>
            )
          })}
        </ul>
        <p className="mt-2 text-xs text-plum-500" data-testid="cost-status">
          {COST_STATUS_LABEL[tale.costStatus]}.
        </p>
        {tale.costStatus === 'conflict' && (
          <div className="mt-1 rounded-xl bg-amber-50 p-2 text-xs text-amber-900" data-testid="cost-conflict">
            <p>Wiki : {types.map((a) => `${a.nameEn} (${tale.cost[a.id]})`).join(' ; ')}</p>
            <p>Autre source : {tale.otherReading}</p>
            <p className="mt-1">{CONFLICT_TEXT}</p>
          </div>
        )}
      </section>

      <section className="mt-4 space-y-2" aria-label="Actions">
        {!state && (
          <>
            <button
              onClick={() => onAction('validate')}
              disabled={status !== 'ready'}
              className={`${action} bg-plum-700 text-white`}
            >
              ✅ Valider et déduire les anigamis
              {status === 'missing' && <span className="block text-xs font-normal text-white/80">Il en manque {view.missingTotal} : impossible de valider.</span>}
              {status === 'to-confirm' && <span className="block text-xs font-normal text-white/80">Coûts à confirmer : aucune déduction automatique.</span>}
            </button>
            <button onClick={() => onAction('mark')} className={`${action} bg-plum-100 text-plum-800`}>
              ☑️ Marquer terminé sans déduire
              <span className="block text-xs font-normal text-plum-600">Pour un puzzle déjà fait en jeu : tes compteurs ne changent pas.</span>
            </button>
          </>
        )}
        {state && (
          <>
            <p className="rounded-2xl bg-gold-200/70 p-3 text-sm text-plum-800" data-testid="puzzle-done-info">
              Terminé le {dayText(state.doneAt)} — {state.opId ? 'anigamis déduits' : 'marqué terminé sans déduction'}.
            </p>
            {state.opId && undoable && (
              <button onClick={() => onAction('undo')} className={`${action} bg-plum-700 text-white`}>
                ↩️ Annuler cette validation
                <span className="block text-xs font-normal text-white/80">Rend les anigamis déduits ; tes autres modifications sont conservées.</span>
              </button>
            )}
            <button onClick={() => onAction('reopen')} className={`${action} bg-plum-50 text-plum-800`}>
              ↺ Remettre en cours
              {state.opId && <span className="block text-xs font-normal text-plum-600">Sans rendre les anigamis déduits.</span>}
            </button>
          </>
        )}
      </section>

      <p className="mt-4 text-xs text-plum-500">
        Données : Dreamlight Valley Wiki, vérifiées le {dayText(`${TALES_VERIFIED_AT}T12:00:00`)} (
        <a href={TALES_SOURCES.wiki.url} target="_blank" rel="noreferrer" className="underline">
          Snippet Catching
        </a>
        ), coûts comparés à{' '}
        <a href={TALES_SOURCES.comparison.url} target="_blank" rel="noreferrer" className="underline">
          une seconde source
        </a>
        . {CORRESPONDENCE_NOTE}
      </p>
    </BottomSheet>
  )
}
