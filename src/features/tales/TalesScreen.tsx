import { useMemo, useState } from 'react'
import { FilterChips } from '../../components/FilterChips'
import { ProgressBar } from '../../components/ProgressBar'
import { RenameSheet } from '../../components/RenameSheet'
import { hrefFor } from '../../lib/router'
import { normalize } from '../../lib/search'
import { nameKey } from '../../lib/names'
import type { Companions } from '../../lib/useCompanions'
import { ANIGAMI_BY_ID, ANIGAMI_TYPES, CORRESPONDENCE_NOTE, FAMILY_EMOJI, FAMILY_LABEL, TALES, TALES_SOURCES, TALES_VERIFIED_AT, TALE_BY_ID, type AnigamiFamily } from './data'
import { anigamiName, taleName, NAME_KIND_LABEL } from './display'
import { lastUndoable, newOpId, puzzleView, summarizeTales, type PuzzleStatus } from './model'
import { AnigamiRow, NameBadge } from './AnigamiRow'
import { ConfirmSheet, type RecapRow } from './ConfirmSheet'
import { PuzzleSheet, STATUS_ICON, STATUS_LABEL, STATUS_STYLE, type PuzzleAction } from './PuzzleSheet'
import type { TalesState } from './useTales'

type View = 'puzzles' | 'anigamis'
type Filter = 'all' | PuzzleStatus

type Confirm = { kind: 'validate'; taleId: string; opId: string } | { kind: 'mark'; taleId: string } | { kind: 'reopen'; taleId: string } | { kind: 'undo' }
type Renaming = { key: string; title: string; officialName: string; officialNote: string; value?: string } | null

const FAMILIES: AnigamiFamily[] = ['bird', 'demon', 'frog']
const dayTime = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export function TalesScreen({ tales, companions }: { tales: TalesState; companions: Companions }) {
  const { data, apply, error } = tales
  const { names, setName } = companions
  const [view, setView] = useState<View>('puzzles')
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const [renaming, setRenaming] = useState<Renaming>(null)

  const summary = useMemo(() => summarizeTales(data), [data])
  const views = useMemo(() => TALES.map((t) => puzzleView(data, t)), [data])
  const undoable = lastUndoable(data)
  const q = normalize(query)

  const matches = (id: string) => {
    if (!q) return true
    const t = TALE_BY_ID[id]
    return normalize([t.nameEn, names[nameKey('tale', t.id)], t.reward].filter(Boolean).join(' ')).includes(q)
  }
  const shown = views
    .filter((v) => (filter === 'all' || v.status === filter) && matches(v.tale.id))
    .sort((a, b) => (filter === 'missing' ? a.missingTotal - b.missingTotal : 0))
  const open = openId ? views.find((v) => v.tale.id === openId) : undefined

  const owned = (id: string) => data.counts[id] ?? 0

  const startRename = (key: string, nameEn: string, current: string | undefined, officialName: string, officialNote: string) =>
    setRenaming({ key, title: `Mon nom pour « ${nameEn} »`, officialName, officialNote, value: current })

  const renameTale = (id: string) => {
    const t = TALE_BY_ID[id]
    const key = nameKey('tale', id)
    startRename(key, t.nameEn, names[key], t.nameEn, 'nom anglais du wiki, français à confirmer')
  }
  const renameAnigami = (id: string) => {
    const a = ANIGAMI_BY_ID[id]
    const key = nameKey('anigami', id)
    const official = anigamiName(a, {})
    startRename(key, official.text, names[key], official.text, NAME_KIND_LABEL[official.kind].toLowerCase())
  }

  const chips: { id: Filter; label: string }[] = [
    { id: 'all', label: `Tous (${summary.total})` },
    { id: 'ready', label: `🟢 Réalisables (${summary.ready})` },
    { id: 'missing', label: `🔸 Il manque (${summary.missing})` },
    { id: 'done', label: `✅ Terminés (${summary.done})` },
    { id: 'to-confirm', label: `❔ À confirmer (${summary.toConfirm})` },
  ]

  // — Fiche de confirmation selon l'opération
  const confirmProps = (c: Confirm) => {
    if (c.kind === 'validate') {
      const tale = TALE_BY_ID[c.taleId]
      const rows: RecapRow[] = ANIGAMI_TYPES.filter((a) => Object.hasOwn(tale.cost, a.id)).map((a) => ({
        label: anigamiName(a, names).text,
        before: owned(a.id),
        after: owned(a.id) - tale.cost[a.id],
      }))
      // Les compteurs ont pu changer depuis l'ouverture (autre onglet) : on le dit au lieu d'afficher un négatif.
      const blockedReason = data.puzzles[c.taleId]
        ? 'Ce puzzle vient d’être terminé : il n’y a plus rien à valider.'
        : rows.some((r) => r.after < 0)
          ? 'Tes compteurs ont changé : il manque maintenant des anigamis. Rien n’est déduit.'
          : undefined
      return {
        blockedReason,
        title: `Valider « ${taleName(tale, names).text} » ?`,
        message: 'Ces anigamis seront déduits de tes compteurs. Tu pourras annuler cette validation tant que le puzzle n’a pas été modifié.',
        rows,
        confirmLabel: 'Valider et déduire',
        run: () => apply({ type: 'validate', taleId: c.taleId, opId: c.opId }),
      }
    }
    if (c.kind === 'mark') {
      return {
        title: `Marquer « ${taleName(TALE_BY_ID[c.taleId], names).text} » terminé ?`,
        message: 'Le puzzle sera marqué terminé. Aucun anigami ne sera déduit : tes compteurs ne changent pas.',
        confirmLabel: 'Marquer terminé',
        run: () => apply({ type: 'mark-done', taleId: c.taleId }),
      }
    }
    if (c.kind === 'reopen') {
      const state = data.puzzles[c.taleId]
      return {
        title: `Remettre « ${taleName(TALE_BY_ID[c.taleId], names).text} » en cours ?`,
        message: state?.opId
          ? 'Les anigamis déduits à la validation ne seront PAS rendus. Pour les récupérer, utilise plutôt « Annuler cette validation ».'
          : 'Le puzzle redevient « en cours ». Tes compteurs ne changent pas.',
        confirmLabel: 'Remettre en cours',
        tone: state?.opId ? ('warning' as const) : ('normal' as const),
        run: () => apply({ type: 'reopen', taleId: c.taleId }),
      }
    }
    const last = undoable
    const rows: RecapRow[] = last
      ? ANIGAMI_TYPES.filter((a) => Object.hasOwn(last.deltas, a.id)).map((a) => ({ label: anigamiName(a, names).text, before: owned(a.id), after: owned(a.id) + last.deltas[a.id] }))
      : []
    return {
      title: last ? `Annuler la validation de « ${taleName(TALE_BY_ID[last.taleId], names).text} » ?` : 'Rien à annuler',
      message: 'Les anigamis déduits sont rendus à tes compteurs ACTUELS : tes modifications manuelles faites depuis sont conservées. Le puzzle redevient « en cours ».',
      rows,
      confirmLabel: 'Annuler la validation',
      run: () => apply({ type: 'undo-last' }),
    }
  }

  const rowFor = (id: string) => {
    const a = ANIGAMI_BY_ID[id]
    return (
      <AnigamiRow
        key={a.id}
        type={a}
        name={anigamiName(a, names)}
        count={owned(a.id)}
        usage={summary.perType[a.id]}
        onAdjust={(delta) => apply({ type: 'adjust', id: a.id, delta })}
        onSet={(count) => apply({ type: 'set-count', id: a.id, count })}
        onRename={() => renameAnigami(a.id)}
      />
    )
  }

  const onPuzzleAction = (id: string, a: PuzzleAction) => {
    if (a === 'validate') setConfirm({ kind: 'validate', taleId: id, opId: newOpId() })
    else if (a === 'mark') setConfirm({ kind: 'mark', taleId: id })
    else if (a === 'reopen') setConfirm({ kind: 'reopen', taleId: id })
    else setConfirm({ kind: 'undo' })
  }

  const card = confirm ? confirmProps(confirm) : null

  return (
    <div className="animate-fade-up">
      <div className="sticky top-0 z-20 -mx-4 bg-night-900/80 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 backdrop-blur-md">
        <a href={hrefFor({ name: 'collection' })} className="text-xs font-semibold text-gold-200">
          ‹ Collection
        </a>
        <h1 className="text-gold font-magic text-3xl font-bold">Puzzles</h1>
        <FilterChips<View>
          label="Vue"
          chips={[
            { id: 'puzzles', label: '🧩 Puzzles' },
            { id: 'anigamis', label: '📜 Anigamis' },
          ]}
          value={view}
          onChange={setView}
        />
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-2xl bg-rose-100 p-3 text-sm text-rose-800">
          {error}
        </p>
      )}

      <section className="glass mt-3 rounded-3xl p-4" aria-label="Résumé">
        <ProgressBar done={summary.done} total={summary.total} label="Puzzles terminés" />
        <p className="mt-2 text-sm font-semibold text-plum-900" data-testid="tales-progress">
          {summary.done} puzzle{summary.done > 1 ? 's' : ''} terminé{summary.done > 1 ? 's' : ''} sur {summary.total}
        </p>
        <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
          {[
            ['Possédés', summary.ownedTotal, 'stat-owned'],
            ['Nécessaires', summary.neededTotal, 'stat-needed'],
            ['À obtenir', summary.missingTotal, 'stat-missing'],
          ].map(([label, value, id]) => (
            <div key={id as string} className="rounded-2xl bg-plum-50 p-2">
              <dt className="text-xs text-plum-600">{label}</dt>
              <dd className="font-display text-xl font-semibold text-plum-900" data-testid={id as string}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-plum-600" data-testid="tales-counts">
          {summary.ready} réalisable{summary.ready > 1 ? 's' : ''} · {summary.missing} avec des anigamis manquants · {summary.toConfirm} à coûts à confirmer
        </p>
        <p className="text-xs text-plum-500">« Nécessaires » : anigamis capturables pour terminer les puzzles restants, hors puzzles à coûts à confirmer et hors objets de quête. « Réalisable » : assez d’anigamis pour CE puzzle ; plusieurs puzzles peuvent se partager les mêmes anigamis.</p>
      </section>

      {view === 'puzzles' ? (
        <>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un puzzle…"
            aria-label="Rechercher un puzzle"
            className="mt-3 w-full rounded-2xl border-0 bg-white px-4 py-3 text-base text-plum-900 shadow-sm ring-1 ring-gold-300/40 outline-none placeholder:text-plum-300 focus:ring-2 focus:ring-gold-400"
          />
          <FilterChips<Filter> label="Filtrer les puzzles" chips={chips} value={filter} onChange={setFilter} />
          <p className="mt-2 px-1 text-xs text-plum-200/80">« ① Source unique » : coûts relevés sur le wiki seulement, non recoupés. Les puzzles « À confirmer » n’ont aucune déduction automatique.</p>

          {undoable && (
            <section className="glass mt-3 flex items-center gap-3 rounded-3xl p-3" aria-label="Dernière validation" data-testid="undo-card">
              <p className="min-w-0 flex-1 text-sm text-plum-800">
                Dernière validation : <strong>« {taleName(TALE_BY_ID[undoable.taleId], names).text} »</strong> ({dayTime(undoable.at)})
              </p>
              <button onClick={() => setConfirm({ kind: 'undo' })} className="shrink-0 rounded-full bg-plum-700 px-3 py-2 text-sm font-semibold text-white active:scale-95">
                ↩️ Annuler
              </button>
            </section>
          )}

          <ul className="mt-3 space-y-2" aria-label="Puzzles">
            {shown.map((v) => {
              const n = taleName(v.tale, names)
              const types = Object.keys(v.tale.cost).length
              const total = Object.values(v.tale.cost).reduce((a, b) => a + b, 0)
              return (
                <li key={v.tale.id} className={`glass rounded-3xl p-3 transition ${v.status === 'done' ? 'opacity-70' : ''}`}>
                  <button onClick={() => setOpenId(v.tale.id)} className="w-full text-left">
                    <span className="flex items-start justify-between gap-2">
                      <span className="font-display text-base leading-tight font-semibold text-plum-900">
                        {n.text}
                        <NameBadge name={n} />
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-gold-500" aria-hidden>
                        {'★'.repeat(v.tale.stars)}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-plum-500">{v.tale.reward}</span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[v.status]}`}>
                        <span aria-hidden>{STATUS_ICON[v.status]}</span> {STATUS_LABEL[v.status]}
                        {v.status === 'missing' && ` (${v.missingTotal})`}
                      </span>
                      {v.tale.costStatus === 'single-source' && (
                        <span data-testid="single-source" title="Coûts relevés sur une seule source (le wiki), non recoupés" className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">
                          ① Source unique
                        </span>
                      )}
                      <span className="text-xs text-plum-600">
                        {total} anigamis · {types} type{types > 1 ? 's' : ''}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          {shown.length === 0 && (
            <div className="mt-8 text-center text-plum-100/80">
              <p className="text-4xl" aria-hidden>
                🔍
              </p>
              <p className="mt-2">Aucun puzzle ne correspond.</p>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="mt-3 px-1 text-xs text-plum-200/80">
            Indique combien d’anigamis de chaque type tu possèdes. Les noms français viennent d’un guide et restent à confirmer : touche un nom pour donner le tien (✎).
          </p>
          {FAMILIES.map((family) => {
            const types = ANIGAMI_TYPES.filter((a) => a.family === family && a.origin === 'catch')
            return (
              <section key={family} className="mt-4" data-testid={`family-${family}`}>
                <h2 className="mb-2 px-1 font-display text-lg font-semibold text-gold-200">
                  {FAMILY_EMOJI[family]} {FAMILY_LABEL[family]} à capturer ({types.length})
                </h2>
                <ul className="space-y-2" aria-label={`${FAMILY_LABEL[family]} à capturer`}>
                  {types.map((a) => rowFor(a.id))}
                </ul>
              </section>
            )
          })}
          {/* Objets de quête : séparés des anigamis à capturer, jamais comptés dans les totaux */}
          <section className="mt-8 rounded-3xl border-2 border-dashed border-indigo-300/60 p-3" data-testid="quest-items" aria-labelledby="quest-items-title">
            <h2 id="quest-items-title" className="font-display text-lg font-semibold text-indigo-100">
              📜 Objets de quête ({ANIGAMI_TYPES.filter((a) => a.origin === 'quest').length})
            </h2>
            <p className="mt-1 text-xs text-indigo-100/90">
              Ces objets s’obtiennent pendant des quêtes précises : ce ne sont <strong>pas</strong> des anigamis à capturer au filet. Ils ne comptent pas dans les totaux ci-dessus et ne servent qu’à deux puzzles.
            </p>
            <ul className="mt-3 space-y-2" aria-label="Objets de quête">
              {ANIGAMI_TYPES.filter((a) => a.origin === 'quest').map((a) => rowFor(a.id))}
            </ul>
          </section>
        </>
      )}

      <p className="mt-6 px-1 pb-2 text-center text-xs text-plum-200/70">
        Données : Dreamlight Valley Wiki, vérifiées le {new Date(`${TALES_VERIFIED_AT}T12:00:00`).toLocaleDateString('fr-FR')} (
        <a href={TALES_SOURCES.wiki.url} target="_blank" rel="noreferrer" className="underline">
          Snippet Catching
        </a>
        ). {CORRESPONDENCE_NOTE}
      </p>

      {open && !confirm && !renaming && (
        <PuzzleSheet
          view={open}
          data={data}
          names={names}
          undoable={!!undoable && data.puzzles[open.tale.id]?.opId === undoable.id}
          onAction={(a) => onPuzzleAction(open.tale.id, a)}
          onRename={() => renameTale(open.tale.id)}
          onClose={() => setOpenId(null)}
        />
      )}
      {card && confirm && (
        <ConfirmSheet
          title={card.title}
          message={card.message}
          rows={'rows' in card ? card.rows : undefined}
          confirmLabel={card.confirmLabel}
          tone={'tone' in card ? card.tone : 'normal'}
          blockedReason={'blockedReason' in card ? card.blockedReason : undefined}
          onConfirm={card.run}
          onClose={() => setConfirm(null)}
        />
      )}
      {renaming && (
        <RenameSheet
          title={renaming.title}
          officialName={renaming.officialName}
          officialNote={renaming.officialNote}
          value={renaming.value}
          onClose={() => setRenaming(null)}
          onSave={(name) => {
            setName(renaming.key, name)
            setRenaming(null)
          }}
        />
      )}
    </div>
  )
}
