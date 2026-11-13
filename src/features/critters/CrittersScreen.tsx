import { useMemo, useState } from 'react'
import { FilterChips } from '../../components/FilterChips'
import { ActiveFilters, SortBar, type SortOption, type SortState } from '../../components/ListControls'
import { ProgressBar } from '../../components/ProgressBar'
import { RenameSheet } from '../../components/RenameSheet'
import { COLLECTIONS } from '../../data/characters'
import { hrefFor } from '../../lib/router'
import { normalize } from '../../lib/search'
import { nameKey } from '../../lib/names'
import type { Companions } from '../../lib/useCompanions'
import { localDayKey } from '../tasks/recurrence'
import { availabilityAt } from './availability'
import { CRITTER_DLC, CRITTER_VARIANTS, BIOMES, CRITTERS_SOURCE, CRITTERS_VERIFIED_AT, type CritterVariant } from './data'
import { biomeName, NAME_KIND_LABEL, speciesName, variantName } from './display'
import { GATHER_TYPES, GATHERING_VERIFIED_AT } from './gathering'
import { GatheringSources } from './GatheringSources'
import { matchesGather, sortVariantsByName, type CritterSortKey, type GatherFilter } from './list'
import { isOwned, obtainedStats, summarizeToday, type VariantToday } from './model'
import { CritterRow, NameBadge } from './CritterRow'
import { CritterSheet } from './CritterSheet'
import { ExtensionsSetup } from './ExtensionsSetup'
import type { CrittersState } from './useCritters'

type Mode = 'all' | 'todo' | 'obtained' | 'today'

const SORT_OPTIONS: SortOption<CritterSortKey>[] = [
  { id: 'biome', label: 'Par biome' },
  { id: 'name', label: 'Nom', directions: { asc: 'A → Z', desc: 'Z → A' } },
]
const DEFAULT_SORT: SortState<CritterSortKey> = { key: 'biome', direction: 'asc' }

const GATHER_CHIPS: { id: GatherFilter; label: string }[] = [
  { id: 'all', label: 'Toutes' },
  ...GATHER_TYPES.map((g) => ({ id: g.id as GatherFilter, label: `${g.emoji} ${g.label}` })),
  { id: 'unknown', label: '❔ Non renseignée' },
]

interface Props {
  critters: CrittersState
  companions: Companions
  now: Date
  /** Vue demandée par l'adresse : `today` = « À nourrir aujourd'hui » */
  view: 'all' | 'today'
}

type Renaming = { key: string; title: string; officialName: string; officialNote: string; value?: string } | null

export function CrittersScreen({ critters, companions, now, view }: Props) {
  const { data, levels, apply, setLevel, error } = critters
  const { names, setName } = companions
  const [filter, setFilter] = useState<Exclude<Mode, 'today'>>('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortState<CritterSortKey>>(DEFAULT_SORT)
  const [gather, setGather] = useState<GatherFilter>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<Renaming>(null)
  const mode: Mode = view === 'today' ? 'today' : filter

  const stats = obtainedStats(data)
  const today = useMemo(() => summarizeToday(data, now), [data, now])
  const day = localDayKey(now)
  const q = normalize(query)

  const matches = (v: CritterVariant) => {
    if (!matchesGather(v, gather)) return false
    if (!q) return true
    const text = [v.nameEn, v.nameFr, names[nameKey('critter', v.id)], speciesName(v.species).text, v.area].filter(Boolean).join(' ')
    return normalize(text).includes(q)
  }

  const changeMode = (next: Mode) => {
    if (next === 'today') window.location.hash = hrefFor({ name: 'critters', view: 'today' })
    else {
      setFilter(next)
      if (view === 'today') window.location.hash = hrefFor({ name: 'critters', view: 'all' })
    }
  }

  const row = (variant: CritterVariant, entry?: VariantToday) => {
    const progress = data.progress[variant.id]
    return (
      <CritterRow
        key={variant.id}
        variant={variant}
        progress={progress}
        level={levels[variant.id]}
        name={variantName(variant, names)}
        availability={entry?.availability ?? availabilityAt(variant, now)}
        fedToday={progress?.lastFed === day}
        onOpen={() => setOpenId(variant.id)}
        onObtained={(value) => apply({ type: 'obtained', id: variant.id, value })}
        onFeed={() => apply({ type: 'feed', id: variant.id })}
      />
    )
  }

  const startRenameVariant = (v: CritterVariant) => {
    const n = variantName(v, {})
    const key = nameKey('critter', v.id)
    setRenaming({
      key,
      title: `Mon nom pour « ${n.text} »`,
      officialName: n.text,
      officialNote: NAME_KIND_LABEL[n.kind].toLowerCase(),
      value: names[key],
    })
  }

  const startRenameBiome = (id: string) => {
    const biome = BIOMES.find((b) => b.id === id)!
    const key = nameKey('biome', id)
    setRenaming({
      key,
      title: `Mon nom pour « ${biome.nameEn} »`,
      officialName: biome.nameEn,
      officialNote: 'nom anglais du wiki, français à confirmer',
      value: names[key],
    })
  }

  const open = openId ? CRITTER_VARIANTS.find((v) => v.id === openId) : undefined

  const chips: { id: Mode; label: string }[] = [
    { id: 'all', label: 'Tous' },
    { id: 'todo', label: 'À obtenir' },
    { id: 'obtained', label: 'Obtenus' },
    { id: 'today', label: '🐾 À nourrir aujourd’hui' },
  ]

  // — Liste (Tous / À obtenir / Obtenus), par biome ou triée par nom
  const inList = (v: CritterVariant) => {
    if (!isOwned(data, v.collection) || !matches(v)) return false
    const obtained = data.progress[v.id]?.obtained === true
    return mode === 'obtained' ? obtained : mode === 'todo' ? !obtained : true
  }
  const sortedByName = sort.key === 'name'
  const flat = sortedByName ? sortVariantsByName(CRITTER_VARIANTS.filter(inList), names, sort.direction) : []
  const groups = sortedByName
    ? []
    : BIOMES.map((biome) => ({ biome, items: CRITTER_VARIANTS.filter((v) => v.biome === biome.id && inList(v)) })).filter((g) => g.items.length > 0)
  const listed = sortedByName ? flat.length : groups.reduce((n, g) => n + g.items.length, 0)

  // — Filtres et tris actifs (rappel, retrait individuel, retour à l'affichage complet)
  const sortOption = SORT_OPTIONS.find((o) => o.id === sort.key)!
  const gatherLabel = GATHER_CHIPS.find((c) => c.id === gather)?.label
  const activeFilters = [
    ...(query.trim() ? [{ id: 'query', label: `Recherche : « ${query.trim()} »` }] : []),
    ...(mode === 'todo' || mode === 'obtained' ? [{ id: 'mode', label: chips.find((c) => c.id === mode)!.label }] : []),
    ...(gather !== 'all' && gatherLabel ? [{ id: 'gather', label: `Collecte : ${gatherLabel}` }] : []),
    ...(mode !== 'today' && sort.key !== DEFAULT_SORT.key ? [{ id: 'sort', label: `Tri : ${sortOption.label} (${sortOption.directions?.[sort.direction]})` }] : []),
  ]
  const removeActive = (id: string) => {
    if (id === 'query') setQuery('')
    else if (id === 'mode') setFilter('all')
    else if (id === 'gather') setGather('all')
    else if (id === 'sort') setSort(DEFAULT_SORT)
  }
  const resetAll = () => {
    setQuery('')
    setFilter('all')
    setGather('all')
    setSort(DEFAULT_SORT)
  }

  // — Vue « Aujourd'hui »
  const section = (title: string, hint: string | null, items: VariantToday[], testId: string) =>
    items.filter((e) => matches(e.variant)).length > 0 && (
      <section className="mt-4" data-testid={testId}>
        <h2 className="px-1 font-display text-lg font-semibold text-gold-200">{title}</h2>
        {hint && <p className="px-1 text-xs text-plum-200/80">{hint}</p>}
        <ul className="mt-2 space-y-2" aria-label={title}>
          {items.filter((e) => matches(e.variant)).map((e) => row(e.variant, e))}
        </ul>
      </section>
    )

  return (
    <div className="animate-fade-up">
      <div className="sticky top-0 z-20 -mx-4 bg-night-900/80 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 backdrop-blur-md">
        <a href={hrefFor({ name: 'collection' })} className="text-xs font-semibold text-gold-200">
          ‹ Collection
        </a>
        <h1 className="text-gold font-magic text-3xl font-bold">Animaux</h1>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un animal…"
          aria-label="Rechercher un animal"
          className="mt-2 w-full rounded-2xl border-0 bg-white px-4 py-3 text-base text-plum-900 shadow-sm ring-1 ring-gold-300/40 outline-none placeholder:text-plum-300 focus:ring-2 focus:ring-gold-400"
        />
        <FilterChips label="Filtrer les animaux" chips={chips} value={mode} onChange={changeMode} />
      </div>

      <div className="mt-2 space-y-2" data-testid="list-controls">
        {mode !== 'today' && <SortBar label="Trier les animaux" options={SORT_OPTIONS} value={sort} onChange={setSort} />}
        <div>
          <FilterChips label="Filtrer par capacité de collecte" chips={GATHER_CHIPS} value={gather} onChange={setGather} />
          {gather !== 'all' && (
            <p className="mt-1 px-1 text-xs text-plum-200/80" data-testid="gather-note">
              Donnée provisoire : capacités relevées dans des guides de jeu le {new Date(`${GATHERING_VERIFIED_AT}T12:00:00`).toLocaleDateString('fr-FR')} (<GatheringSources />), à confirmer avec le wiki.
              {gather === 'unknown' && ' « Non renseignée » : espèce non couverte, variante de quête ou sources en désaccord.'}
            </p>
          )}
        </div>
        <ActiveFilters items={activeFilters} onRemove={removeActive} onReset={resetAll} />
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-2xl bg-rose-100 p-3 text-sm text-rose-800">
          {error}
        </p>
      )}

      {!data.configured && <ExtensionsSetup onConfirm={(owned) => apply({ type: 'set-extensions', owned })} />}

      {mode === 'today' ? (
        <>
          <div className="mt-3 space-y-1.5">
            <ProgressBar done={today.done} total={today.total} label="Animaux nourris aujourd’hui" />
            <p className="text-sm font-semibold text-plum-50" data-testid="critters-today-count" aria-live="polite">
              {today.total > 0 ? `🐾 ${today.done}/${today.total} nourris aujourd’hui` : 'Rien à nourrir pour le moment ✨'}
            </p>
            <p className="text-xs text-plum-200/80">
              Ne compte que ce qui est encore réalisable aujourd’hui d’après l’horaire du wiki (heure de ton téléphone). « Présent selon l’horaire » ne garantit pas que l’animal apparaîtra.
            </p>
          </div>
          {section('À nourrir', 'Présents maintenant en premier, puis ceux qui arrivent plus tard.', today.toFeed, 'section-to-feed')}
          {section('Nourris aujourd’hui', null, today.fed, 'section-fed')}
          {section('Occasion manquée', 'Le créneau est terminé et ils n’ont pas été nourris : ils ne comptent plus aujourd’hui.', today.missed, 'section-missed')}
          {section('Sous conditions (non comptés)', 'Météo ou quête requise : l’app ne peut pas savoir si c’est possible aujourd’hui.', today.conditional, 'section-conditional')}
          {section('Horaire inconnu ou à confirmer (non comptés)', null, today.unknown, 'section-unknown')}
          {today.absent.length > 0 && (
            <p className="mt-4 px-1 text-xs text-plum-200/80" data-testid="absent-count">
              {today.absent.length} animal{today.absent.length > 1 ? 'aux' : ''} non obtenu{today.absent.length > 1 ? 's' : ''} absent{today.absent.length > 1 ? 's' : ''} aujourd’hui.
            </p>
          )}
        </>
      ) : (
        <>
          <div className="mt-3 space-y-1.5">
            <ProgressBar done={stats.obtained} total={stats.total} label="Animaux obtenus" />
            <p className="text-sm font-semibold text-plum-50" data-testid="critters-obtained">
              {stats.obtained} obtenu{stats.obtained > 1 ? 's' : ''} sur {stats.total}
            </p>
          </div>

          {data.configured && (
          <details className="glass mt-3 rounded-3xl p-3">
            <summary className="cursor-pointer text-sm font-semibold text-plum-900">
              Mes extensions ({CRITTER_DLC.filter((c) => isOwned(data, c)).length}/{CRITTER_DLC.length})
            </summary>
            <p className="mt-2 text-xs text-plum-600">Coche celles que tu possèdes : les animaux des autres sont masqués et ne comptent jamais dans « Aujourd’hui ».</p>
            <button
              onClick={() => apply({ type: 'set-extensions', owned: Object.fromEntries(CRITTER_DLC.map((c) => [c, true])) })}
              className="mt-2 rounded-full bg-plum-100 px-3 py-1.5 text-sm font-semibold text-plum-800 active:scale-95"
            >
              Tout sélectionner
            </button>
            <ul className="mt-2 space-y-1" aria-label="Mes extensions">
              {CRITTER_DLC.map((c) => (
                <li key={c}>
                  <label className="flex items-center gap-3 py-1 text-sm font-semibold text-plum-800">
                    <input
                      type="checkbox"
                      className="size-5 accent-plum-700"
                      checked={isOwned(data, c)}
                      onChange={(e) => apply({ type: 'owned', collection: c, value: e.target.checked })}
                    />
                    {COLLECTIONS.find((x) => x.id === c)?.label}
                  </label>
                </li>
              ))}
            </ul>
          </details>
          )}

          <p className="mt-3 px-1 text-xs text-plum-200/80">
            Les noms de biomes et de zones sont ceux du wiki anglais : le nom français est à confirmer (tu peux donner le tien avec ✎).
          </p>
          <p className="mt-1 px-1 text-xs text-plum-200/80" data-testid="threshold-legend">
            Nourrissages : « 2/3 » = seuil exact indiqué par le wiki ; « au moins 3 » = le seuil réel est inconnu ; « seuil inconnu » = non indiqué. Aucun nombre ne garantit l’obtention : seule la case « Obtenu » fait foi.
          </p>

          {sortedByName && flat.length > 0 && (
            <section className="mt-5" data-testid="critters-sorted">
              <h2 className="mb-2 px-1 font-display text-lg font-semibold text-gold-200">✦ Triés par nom ({sort.direction === 'asc' ? 'A → Z' : 'Z → A'})</h2>
              <ul className="space-y-2" aria-label="Animaux triés par nom">
                {flat.map((v) => row(v))}
              </ul>
            </section>
          )}
          {groups.map(({ biome, items }) => {
            const label = biomeName(biome, names)
            const owned = CRITTER_VARIANTS.filter((v) => v.biome === biome.id)
            const got = owned.filter((v) => data.progress[v.id]?.obtained).length
            return (
              <section key={biome.id} className="mt-5" data-testid={`biome-${biome.id}`}>
                <h2 className="mb-2 flex flex-wrap items-baseline gap-x-2 px-1">
                  <span className="font-display text-lg font-semibold text-gold-200">✦ {label.text}</span>
                  <NameBadge name={label} />
                  <span className="text-xs text-plum-200/80">
                    {got}/{owned.length}
                    {biome.collection !== 'base' && ` · ${COLLECTIONS.find((c) => c.id === biome.collection)?.label}`}
                  </span>
                  <button onClick={() => startRenameBiome(biome.id)} aria-label={`Renommer le biome ${label.text}`} className="rounded-full px-1.5 text-sm text-plum-200 active:scale-90">
                    ✎
                  </button>
                </h2>
                <ul className="space-y-2" aria-label={biome.nameEn}>
                  {items.map((v) => row(v))}
                </ul>
              </section>
            )
          })}
          {listed === 0 && (
            <div className="mt-8 text-center text-plum-100/80">
              <p className="text-4xl" aria-hidden>
                🔍
              </p>
              <p className="mt-2">Aucun animal ne correspond.</p>
              {activeFilters.length > 0 && (
                <button type="button" onClick={resetAll} className="mt-2 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold text-gold-200 ring-1 ring-white/20 active:scale-95">
                  Tout afficher
                </button>
              )}
            </div>
          )}
        </>
      )}

      <p className="mt-6 px-1 pb-2 text-center text-xs text-plum-200/70">
        Données : Dreamlight Valley Wiki, vérifiées le {new Date(`${CRITTERS_VERIFIED_AT}T12:00:00`).toLocaleDateString('fr-FR')} (
        <a href={CRITTERS_SOURCE} target="_blank" rel="noreferrer" className="underline">
          Critters
        </a>
        ). Keepsake Sea : à vérifier après la sortie.
      </p>

      {open && !renaming && (
        <CritterSheet
          variant={open}
          progress={data.progress[open.id]}
          level={levels[open.id]}
          names={names}
          now={now}
          onFeed={() => apply({ type: 'feed', id: open.id })}
          onUnfeed={() => apply({ type: 'unfeed', id: open.id })}
          onObtained={(value) => apply({ type: 'obtained', id: open.id, value })}
          onSetFeedings={(count) => apply({ type: 'set-feedings', id: open.id, count })}
          onSetLevel={(level) => setLevel(open.id, level)}
          onRename={() => startRenameVariant(open)}
          onClose={() => setOpenId(null)}
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
