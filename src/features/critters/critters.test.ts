import { describe, expect, it } from 'vitest'
import { availabilityAt, describeAvailability, formatWindows } from './availability'
import {
  BIOME_BY_ID,
  BIOMES,
  CRITTER_BY_ID,
  CRITTER_DLC,
  CRITTER_VARIANTS,
  SPECIES,
  SPECIES_BY_ID,
  WIKI_PAGE,
  isBiomeId,
  isVariantId,
} from './data'
import {
  applyCritterOp,
  CritterError,
  emptyCritters,
  isOwned,
  obtainedStats,
  ownedVariants,
  sanitizeCritters,
  summarizeToday,
  type CritterOp,
  type CrittersData,
} from './model'
import { critterTaskOverride } from './today'

/** Heure murale à Bruxelles (le fuseau des tests). 2026-11-09 est un lundi. */
const bxl = (iso: string) => new Date(iso)
const ids = (items: { variant: { id: string } }[]) => items.map((i) => i.variant.id)

/** Applique une suite d'opérations à des heures données. */
function run(steps: [CritterOp, string][], start: CrittersData = emptyCritters()): CrittersData {
  return steps.reduce((d, [op, at]) => applyCritterOp(d, op, bxl(at)), start)
}

const ALL_EXTENSIONS = { eternity: true, storybook: true, wishblossom: true, honeyglow: true }

/**
 * Toutes les variantes obtenues sauf celles indiquées, toutes les extensions possédées :
 * situation de test précise et déterministe.
 */
function allObtainedExcept(keep: string[]): CrittersData {
  const data: CrittersData = { ...emptyCritters(), configured: true, owned: { ...ALL_EXTENSIONS } }
  for (const v of CRITTER_VARIANTS) if (!keep.includes(v.id)) data.progress[v.id] = { obtained: true }
  return data
}

describe('données : 90 variantes extraites du wiki', () => {
  it('90 variantes, identifiants uniques, adresses du wiki cohérentes', () => {
    expect(CRITTER_VARIANTS).toHaveLength(90)
    expect(new Set(CRITTER_VARIANTS.map((v) => v.id)).size).toBe(90)
    for (const v of CRITTER_VARIANTS) expect(v.wikiUrl).toBe(WIKI_PAGE(v.nameEn))
  })

  it('chaque variante pointe vers une espèce et un biome qui existent ; l’extension vient du biome', () => {
    for (const v of CRITTER_VARIANTS) {
      expect(SPECIES_BY_ID[v.species], v.id).toBeDefined()
      expect(BIOME_BY_ID[v.biome], v.id).toBeDefined()
      expect(v.collection, v.id).toBe(BIOME_BY_ID[v.biome].collection)
    }
    expect(new Set(SPECIES.map((s) => s.id)).size).toBe(SPECIES.length)
    expect(new Set(BIOMES.map((b) => b.id)).size).toBe(BIOMES.length)
    // Aucun biome ni espèce inutilisés
    for (const b of BIOMES) expect(CRITTER_VARIANTS.some((v) => v.biome === b.id), b.id).toBe(true)
    for (const s of SPECIES) expect(CRITTER_VARIANTS.some((v) => v.species === s.id), s.id).toBe(true)
  })

  it('répartition par extension, d’après les notes du wiki', () => {
    const count = (c: string) => CRITTER_VARIANTS.filter((v) => v.collection === c).length
    expect([count('base'), count('eternity'), count('storybook'), count('wishblossom'), count('honeyglow')]).toEqual([41, 18, 14, 13, 4])
    expect(CRITTER_DLC).toEqual(['eternity', 'storybook', 'wishblossom', 'honeyglow'])
  })

  it('Keepsake Sea : aucune créature ajoutée d’après les annonces', () => {
    expect(CRITTER_VARIANTS.filter((v) => v.collection === 'keepsake' || v.collection === 'free-upcoming')).toEqual([])
  })

  it('horaires : 7 jours, créneaux valides ; l’Oie dorée a deux créneaux par jour', () => {
    for (const v of CRITTER_VARIANTS) {
      if (v.schedule.status !== 'known') continue
      expect(v.schedule.days, v.id).toHaveLength(7)
      for (const day of v.schedule.days) for (const w of day) expect(w.from >= 0 && w.to <= 24 && w.from < w.to, v.id).toBe(true)
    }
    const goose = CRITTER_BY_ID['golden-goose'].schedule
    expect(goose.status === 'known' && goose.days.every((d) => d.length === 2 && d[0].from === 7 && d[1].from === 19)).toBe(true)
  })

  it('noms français : seulement ceux du wiki, sans traduction déduite', () => {
    const withFr = CRITTER_VARIANTS.filter((v) => v.nameFr)
    expect(withFr).toHaveLength(54)
    expect(CRITTER_VARIANTS.filter((v) => !v.nameFr)).toHaveLength(36)
    expect(CRITTER_BY_ID['calico-rabbit'].nameFr).toBe('Lapin calico')
    expect(CRITTER_BY_ID['red-sunbird'].nameFr).toBeUndefined()
  })

  it('nom français d’une espèce : seulement s’il est partagé par les noms français de ses variantes', () => {
    for (const s of SPECIES) {
      const fr = CRITTER_VARIANTS.filter((v) => v.species === s.id && v.nameFr).map((v) => v.nameFr!)
      if (s.nameFr) {
        expect(fr.length, s.id).toBeGreaterThanOrEqual(2)
        for (const name of fr) expect(name.startsWith(s.nameFr), `${s.id} / ${name}`).toBe(true)
      } else {
        // Un seul exemple (ou aucun) : on ne devine pas le nom de l'espèce
        expect(fr.length, s.id).toBeLessThan(2)
      }
    }
    expect(SPECIES_BY_ID.skunk.nameFr).toBeUndefined()
    expect(SPECIES_BY_ID['sweet-bee'].nameFr).toBeUndefined()
  })

  it('minimum de nourrissages : exact (« 3 »), au moins (« 3+ ») ou non indiqué, jamais complété', () => {
    expect(CRITTER_BY_ID['calico-rabbit'].feedings).toEqual({ min: 2, exact: true })
    expect(CRITTER_BY_ID['emerald-sunbird'].feedings).toEqual({ min: 4, exact: false })
    expect(CRITTER_BY_ID['toon-monkey'].feedings).toEqual({ min: 4, exact: true })
    expect(CRITTER_BY_ID['green-hedgehog'].feedings).toBeUndefined()
    // Relevé du 09/11/2026 : « 1 » ×6, « 2 » ×13, « 3 » ×15, « 4 » ×3, « 3+ » ×10, « 4+ » ×11, « 5+ » ×10, vide ×22
    const exact = CRITTER_VARIANTS.filter((v) => v.feedings?.exact)
    const atLeast = CRITTER_VARIANTS.filter((v) => v.feedings && !v.feedings.exact)
    const unknown = CRITTER_VARIANTS.filter((v) => !v.feedings)
    expect([exact.length, atLeast.length, unknown.length]).toEqual([37, 31, 22])
  })

  it('contradiction et conditions du wiki : horaire à confirmer, météo, quête', () => {
    expect(CRITTER_BY_ID['white-sweet-bee'].schedule).toMatchObject({ status: 'unknown', reason: 'conflict' })
    expect(CRITTER_VARIANTS.filter((v) => v.condition).map((v) => [v.id, v.condition])).toEqual([
      ['toon-capybara', 'quest'],
      ['toon-cobra', 'quest'],
      ['toon-monkey', 'quest'],
      ['patterned-skunk', 'rain'],
      ['blue-sweet-bee', 'clear'],
    ])
  })

  it('validation des identifiants (propriétés héritées de JavaScript refusées)', () => {
    expect(isVariantId('calico-rabbit')).toBe(true)
    expect(isVariantId('constructor')).toBe(false)
    expect(isVariantId('__proto__')).toBe(false)
    expect(isBiomeId('wild-tangle')).toBe(true)
    expect(isBiomeId('toString')).toBe(false)
  })
})

describe('disponibilité du jour (heure locale, Europe/Brussels)', () => {
  const rabbit = CRITTER_BY_ID['calico-rabbit'] // jeudi, toute la journée
  const goose = CRITTER_BY_ID['black-goose'] // tous les jours 5 h–11 h
  const golden = CRITTER_BY_ID['golden-goose'] // tous les jours 7 h–8 h et 19 h–20 h
  const unknown = CRITTER_BY_ID['white-sweet-bee']

  it('présent selon l’horaire', () => {
    expect(availabilityAt(rabbit, bxl('2026-11-12T10:00:00'))).toEqual({ state: 'present', until: 24 })
    expect(availabilityAt(goose, bxl('2026-11-09T08:30:00'))).toEqual({ state: 'present', until: 11 })
  })

  it('disponible plus tard', () => {
    expect(availabilityAt(goose, bxl('2026-11-09T04:00:00'))).toEqual({ state: 'later', from: 5 })
    expect(availabilityAt(golden, bxl('2026-11-09T12:00:00'))).toEqual({ state: 'later', from: 19 })
    expect(availabilityAt(golden, bxl('2026-11-09T07:30:00'))).toEqual({ state: 'present', until: 8 })
  })

  it('créneau passé', () => {
    expect(availabilityAt(goose, bxl('2026-11-09T12:00:00'))).toEqual({ state: 'passed' })
    expect(availabilityAt(golden, bxl('2026-11-09T20:30:00'))).toEqual({ state: 'passed' })
  })

  it('absent aujourd’hui', () => {
    expect(availabilityAt(rabbit, bxl('2026-11-09T12:00:00'))).toEqual({ state: 'absent' }) // lundi
    expect(availabilityAt(rabbit, bxl('2026-11-13T12:00:00'))).toEqual({ state: 'absent' }) // vendredi
  })

  it('horaire inconnu (contradiction des sources)', () => {
    const a = availabilityAt(unknown, bxl('2026-11-09T21:00:00'))
    expect(a).toMatchObject({ state: 'unknown', reason: 'conflict' })
    expect(describeAvailability(a)).toBe('Horaire à confirmer')
  })

  it('bornes : le début est inclus, la fin est exclue', () => {
    expect(availabilityAt(goose, bxl('2026-11-09T04:59:00')).state).toBe('later')
    expect(availabilityAt(goose, bxl('2026-11-09T05:00:00')).state).toBe('present')
    expect(availabilityAt(goose, bxl('2026-11-09T10:59:00')).state).toBe('present')
    expect(availabilityAt(goose, bxl('2026-11-09T11:00:00')).state).toBe('passed')
  })

  it('minuit change de jour : l’animal du jeudi n’est plus là, celui du vendredi arrive', () => {
    expect(availabilityAt(rabbit, bxl('2026-11-11T23:59:00')).state).toBe('absent') // mercredi
    expect(availabilityAt(rabbit, bxl('2026-11-12T00:01:00')).state).toBe('present') // jeudi
    expect(availabilityAt(rabbit, bxl('2026-11-12T23:59:00')).state).toBe('present')
    expect(availabilityAt(rabbit, bxl('2026-11-13T00:01:00')).state).toBe('absent') // vendredi
  })

  it('textes affichés', () => {
    expect(describeAvailability({ state: 'present', until: 11 })).toBe('Présent selon l’horaire · jusqu’à 11 h')
    expect(describeAvailability({ state: 'present', until: 24 })).toBe('Présent selon l’horaire')
    expect(describeAvailability({ state: 'later', from: 19 })).toBe('Disponible plus tard · dès 19 h')
    expect(describeAvailability({ state: 'passed' })).toBe('Créneau passé')
    expect(describeAvailability({ state: 'absent' })).toBe('Absent aujourd’hui')
    expect(describeAvailability({ state: 'unknown', reason: 'missing' })).toBe('Horaire inconnu')
    expect(formatWindows([{ from: 0, to: 24 }])).toBe('Toute la journée')
    expect(formatWindows([{ from: 7, to: 8 }, { from: 19, to: 20 }])).toBe('7 h–8 h et 19 h–20 h')
    expect(formatWindows([{ from: 12, to: 24 }])).toBe('12 h–minuit')
  })
})

describe('nourrissages : un seul par jour et par variante', () => {
  const feed = (id: string, at: string): [CritterOp, string] => [{ type: 'feed', id }, at]

  it('un nourrissage augmente la progression, un second le même jour ne change rien', () => {
    const d = run([feed('calico-rabbit', '2026-11-12T09:00:00'), feed('calico-rabbit', '2026-11-12T09:01:00'), feed('calico-rabbit', '2026-11-12T22:00:00')])
    expect(d.progress['calico-rabbit']).toEqual({ feedings: 1, lastFed: '2026-11-12' })
  })

  it('nourrissages multiples : un par jour, comptés indépendamment pour chaque variante', () => {
    const d = run([
      feed('calico-rabbit', '2026-11-12T09:00:00'),
      feed('black-rabbit', '2026-11-12T09:00:00'),
      feed('calico-rabbit', '2026-11-19T09:00:00'),
      feed('calico-rabbit', '2026-11-26T09:00:00'),
    ])
    expect(d.progress['calico-rabbit']).toEqual({ feedings: 3, lastFed: '2026-11-26', prevFed: '2026-11-19' })
    expect(d.progress['black-rabbit']).toEqual({ feedings: 1, lastFed: '2026-11-12' })
    expect(d.progress['classic-rabbit']).toBeUndefined() // les autres variantes du même lapin ne bougent pas
  })

  it('la limite quotidienne suit minuit local : 23 h 59 puis 00 h 01 = deux jours', () => {
    const d = run([feed('classic-capybara', '2026-11-09T23:59:00'), feed('classic-capybara', '2026-11-10T00:01:00'), feed('classic-capybara', '2026-11-10T23:58:00')])
    expect(d.progress['classic-capybara']).toMatchObject({ feedings: 2, lastFed: '2026-11-10', prevFed: '2026-11-09' })
  })

  it('nuit du changement d’heure (25/10/2026, 25 heures) : une seule fois pour la même date locale', () => {
    // 00:30 UTC = 02:30 (heure d'été) ; 01:30 UTC = 02:30 (heure d'hiver) : même jour local
    const d = run([feed('classic-capybara', '2026-10-25T00:30:00Z'), feed('classic-capybara', '2026-10-25T01:30:00Z'), feed('classic-capybara', '2026-10-25T22:30:00Z')])
    expect(d.progress['classic-capybara']).toEqual({ feedings: 1, lastFed: '2026-10-25' })
    // Le lendemain compte à nouveau
    expect(applyCritterOp(d, { type: 'feed', id: 'classic-capybara' }, bxl('2026-10-26T08:00:00')).progress['classic-capybara']?.feedings).toBe(2)
  })

  it('annuler le nourrissage d’aujourd’hui rend l’état d’avant ; rien à annuler un autre jour', () => {
    let d = run([feed('calico-rabbit', '2026-11-05T09:00:00'), feed('calico-rabbit', '2026-11-12T09:00:00')])
    expect(applyCritterOp(d, { type: 'unfeed', id: 'calico-rabbit' }, bxl('2026-11-13T09:00:00'))).toBe(d) // pas le même jour
    d = applyCritterOp(d, { type: 'unfeed', id: 'calico-rabbit' }, bxl('2026-11-12T10:00:00'))
    expect(d.progress['calico-rabbit']).toEqual({ feedings: 1, lastFed: '2026-11-05' })
    d = applyCritterOp(d, { type: 'unfeed', id: 'calico-rabbit' }, bxl('2026-11-05T12:00:00'))
    expect(d.progress['calico-rabbit']).toBeUndefined()
    // Après annulation, on peut recompter aujourd'hui
    d = run([feed('calico-rabbit', '2026-11-12T09:00:00')], d)
    expect(d.progress['calico-rabbit']?.feedings).toBe(1)
  })

  it('correction manuelle du total, sans toucher à la date du dernier nourrissage', () => {
    let d = run([feed('calico-rabbit', '2026-11-12T09:00:00')])
    d = applyCritterOp(d, { type: 'set-feedings', id: 'calico-rabbit', count: 5 }, bxl('2026-11-12T10:00:00'))
    expect(d.progress['calico-rabbit']).toMatchObject({ feedings: 5, lastFed: '2026-11-12' })
    d = applyCritterOp(d, { type: 'set-feedings', id: 'calico-rabbit', count: 0 }, bxl('2026-11-12T10:00:00'))
    expect(d.progress['calico-rabbit']?.feedings).toBeUndefined()
    expect(() => applyCritterOp(d, { type: 'set-feedings', id: 'calico-rabbit', count: -1 }, bxl('2026-11-12T10:00:00'))).toThrow(CritterError)
    expect(() => applyCritterOp(d, { type: 'set-feedings', id: 'calico-rabbit', count: 100 }, bxl('2026-11-12T10:00:00'))).toThrow(CritterError)
    expect(() => applyCritterOp(d, { type: 'set-feedings', id: 'calico-rabbit', count: 2.5 }, bxl('2026-11-12T10:00:00'))).toThrow(CritterError)
  })

  it('obtenu : coché et décoché à la main, on ne nourrit plus un animal obtenu', () => {
    let d = run([feed('calico-rabbit', '2026-11-12T09:00:00'), [{ type: 'obtained', id: 'calico-rabbit', value: true }, '2026-11-12T09:05:00']])
    expect(d.progress['calico-rabbit']).toEqual({ obtained: true, feedings: 1, lastFed: '2026-11-12' })
    expect(() => applyCritterOp(d, { type: 'feed', id: 'calico-rabbit' }, bxl('2026-11-19T09:00:00'))).toThrow('déjà obtenu')
    d = applyCritterOp(d, { type: 'obtained', id: 'calico-rabbit', value: false }, bxl('2026-11-19T09:00:00'))
    expect(d.progress['calico-rabbit']).toEqual({ feedings: 1, lastFed: '2026-11-12' })
  })

  it('refuse un animal ou une extension inconnus', () => {
    expect(() => applyCritterOp(emptyCritters(), { type: 'feed', id: 'constructor' }, bxl('2026-11-12T09:00:00'))).toThrow('inconnu')
    expect(() => applyCritterOp(emptyCritters(), { type: 'owned', collection: 'base', value: false }, bxl('2026-11-12T09:00:00'))).toThrow(CritterError)
  })

  it('nettoyage des données lues : variantes inconnues, valeurs et dates invalides écartées', () => {
    const raw = JSON.parse(
      '{"owned":{"eternity":false,"base":false,"honeyglow":"non"},"progress":{' +
        '"calico-rabbit":{"obtained":true,"feedings":3,"lastFed":"2026-11-12","prevFed":"2026-11-05","futur":1},' +
        '"black-rabbit":{"feedings":0,"lastFed":"hier"},"inconnu":{"obtained":true},"constructor":{"obtained":true},"__proto__":{"obtained":true},' +
        '"classic-rabbit":{"feedings":2.5,"prevFed":"2026-11-05"},"white-rabbit":{"lastFed":"2026-11-12","prevFed":"2026-11-20"}}}',
    )
    const clean = sanitizeCritters(raw)
    expect(clean.owned).toEqual({ eternity: false })
    expect(clean.configured).toBe(true) // un choix d'extension déjà enregistré vaut configuration faite
    expect(clean.progress).toEqual({
      'calico-rabbit': { obtained: true, feedings: 3, lastFed: '2026-11-12', prevFed: '2026-11-05' },
      'white-rabbit': { lastFed: '2026-11-12' }, // prevFed postérieur à lastFed : écarté
    })
    expect(sanitizeCritters(['x'])).toEqual(emptyCritters())
  })
})

describe('mes extensions : choisies par la joueuse, jamais supposées', () => {
  const NOON = bxl('2026-11-09T12:00:00')

  it('par défaut : rien n’est configuré et seul le jeu de base est visible', () => {
    const d = emptyCritters()
    expect(d).toEqual({ owned: {}, configured: false, progress: {} })
    for (const c of CRITTER_DLC) expect(isOwned(d, c)).toBe(false)
    expect(isOwned(d, 'base')).toBe(true)
    expect(obtainedStats(d)).toEqual({ obtained: 0, total: 41 })
    expect(ownedVariants(d)).toHaveLength(41)
    expect(ownedVariants(d).every((v) => v.collection === 'base')).toBe(true)
  })

  it('une extension absente ou à false n’est pas possédée ; seul true la rend visible', () => {
    expect(isOwned({ ...emptyCritters(), owned: { eternity: true, storybook: false } }, 'eternity')).toBe(true)
    expect(isOwned({ ...emptyCritters(), owned: { eternity: true, storybook: false } }, 'storybook')).toBe(false)
    expect(isOwned({ ...emptyCritters(), owned: { eternity: true } }, 'wishblossom')).toBe(false)
  })

  it('configuration initiale : choix des extensions, « tout sélectionner », jeu de base seul', () => {
    let d = applyCritterOp(emptyCritters(), { type: 'set-extensions', owned: { eternity: true, honeyglow: true } }, NOON)
    expect(d).toMatchObject({ configured: true, owned: { eternity: true, storybook: false, wishblossom: false, honeyglow: true } })
    expect(obtainedStats(d).total).toBe(41 + 18 + 4)
    d = applyCritterOp(d, { type: 'set-extensions', owned: ALL_EXTENSIONS }, NOON)
    expect(obtainedStats(d).total).toBe(90)
    // Jeu de base seul : un choix valide, qui vaut configuration faite
    d = applyCritterOp(d, { type: 'set-extensions', owned: {} }, NOON)
    expect(d).toMatchObject({ configured: true, owned: { eternity: false, storybook: false, wishblossom: false, honeyglow: false } })
    expect(obtainedStats(d).total).toBe(41)
    expect(() => applyCritterOp(d, { type: 'set-extensions', owned: { eternity: 'oui' as never } }, NOON)).toThrow(CritterError)
  })

  it('modifiable plus tard : un choix isolé conserve les autres et marque la configuration', () => {
    let d = applyCritterOp(emptyCritters(), { type: 'owned', collection: 'storybook', value: true }, NOON)
    expect(d).toMatchObject({ configured: true, owned: { storybook: true } })
    d = applyCritterOp(d, { type: 'owned', collection: 'wishblossom', value: true }, NOON)
    d = applyCritterOp(d, { type: 'owned', collection: 'storybook', value: false }, NOON)
    expect(d.owned).toEqual({ storybook: false, wishblossom: true })
  })

  it('les extensions non possédées n’influencent JAMAIS le compteur quotidien (tous jours et heures)', () => {
    const subsets: Record<string, boolean>[] = [{}, { eternity: true }, { storybook: true, honeyglow: true }, { wishblossom: true, eternity: true, honeyglow: true }, ALL_EXTENSIONS]
    for (const owned of subsets) {
      const data: CrittersData = { ...emptyCritters(), configured: true, owned }
      for (let day = 9; day <= 15; day++) {
        for (let hour = 0; hour < 24; hour += 3) {
          const s = summarizeToday(data, bxl(`2026-11-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:15:00`))
          const all = [...s.fed, ...s.toFeed, ...s.missed, ...s.conditional, ...s.unknown, ...s.absent]
          for (const e of all) expect(e.variant.collection === 'base' || owned[e.variant.collection] === true, `${e.variant.id} (${JSON.stringify(owned)})`).toBe(true)
        }
      }
    }
  })

  it('un animal d’une extension non possédée déjà nourri ne compte pas et garde sa progression', () => {
    const d = run([[{ type: 'feed', id: 'classic-capybara' }, '2026-11-09T12:00:00']], { ...emptyCritters(), configured: true })
    expect(d.progress['classic-capybara']?.feedings).toBe(1) // progression conservée…
    expect(summarizeToday(d, NOON).total).toBe(summarizeToday(emptyCritters(), NOON).total) // …sans influencer le compteur
    const withEternity = applyCritterOp(d, { type: 'owned', collection: 'eternity', value: true }, NOON)
    expect(ids(summarizeToday(withEternity, NOON).fed)).toEqual(['classic-capybara']) // elle réapparaît si l'extension est cochée
  })

  it('ligne du jour : rappel tant que les extensions ne sont pas choisies', () => {
    const base = allObtainedExcept(['classic-squirrel'])
    expect(critterTaskOverride(base, NOON).meta).not.toContain('extensions à choisir')
    const unconfigured = { ...base, configured: false, owned: {} }
    expect(critterTaskOverride(unconfigured, NOON).meta).toContain('extensions à choisir')
  })
})

describe('compteur du jour « Animaux à nourrir X/Y »', () => {
  // Lundi 9 novembre 2026, midi. Cas précis : tout est obtenu sauf :
  const KEEP = ['classic-capybara', 'golden-goose', 'black-goose', 'calico-rabbit', 'white-sweet-bee', 'toon-capybara']
  const NOON = '2026-11-09T12:00:00'

  it('classe chaque variante : à nourrir, occasion manquée, absent, inconnu, sous condition', () => {
    const s = summarizeToday(allObtainedExcept(KEEP), bxl(NOON))
    expect(ids(s.toFeed)).toEqual(['classic-capybara', 'golden-goose']) // présent d'abord, puis « plus tard »
    expect(ids(s.missed)).toEqual(['black-goose']) // 5 h–11 h : terminé
    expect(ids(s.absent)).toEqual(['calico-rabbit']) // jeudi seulement
    expect(ids(s.unknown)).toEqual(['white-sweet-bee']) // horaires contradictoires
    expect(ids(s.conditional)).toEqual(['toon-capybara']) // quête requise
    expect(ids(s.fed)).toEqual([])
    expect([s.done, s.total]).toEqual([0, 2]) // ni l'inconnu, ni le conditionnel, ni le manqué, ni l'absent
  })

  it('un nourrissage met à jour X/Y ; un créneau terminé après nourrissage reste compté', () => {
    let d = run([[{ type: 'feed', id: 'classic-capybara' }, NOON]], allObtainedExcept(KEEP))
    expect([summarizeToday(d, bxl(NOON)).done, summarizeToday(d, bxl(NOON)).total]).toEqual([1, 2])
    d = applyCritterOp(d, { type: 'feed', id: 'golden-goose' }, bxl('2026-11-09T19:30:00'))
    const evening = summarizeToday(d, bxl('2026-11-09T21:00:00')) // créneau de l'Oie dorée terminé, mais nourrie
    expect(ids(evening.fed)).toEqual(['classic-capybara', 'golden-goose'])
    expect([evening.done, evening.total]).toEqual([2, 2])
    expect(evening.toFeed).toEqual([])
  })

  it('une occasion manquée sort du compteur ; nourrie tard, elle y revient', () => {
    const base = allObtainedExcept(['black-goose', 'classic-capybara'])
    expect(summarizeToday(base, bxl('2026-11-09T09:00:00')).total).toBe(2) // l'Oie noire est encore présente
    const noon = summarizeToday(base, bxl(NOON))
    expect(ids(noon.missed)).toEqual(['black-goose'])
    expect(noon.total).toBe(1)
    const fedLate = summarizeToday(run([[{ type: 'feed', id: 'black-goose' }, NOON]], base), bxl(NOON))
    expect(ids(fedLate.fed)).toContain('black-goose')
    expect(fedLate.total).toBe(2)
  })

  it('un animal obtenu disparaît du compteur', () => {
    let d = allObtainedExcept(['classic-capybara', 'classic-cobra'])
    expect(summarizeToday(d, bxl(NOON)).total).toBe(2)
    d = run([[{ type: 'feed', id: 'classic-cobra' }, NOON]], d)
    expect(summarizeToday(d, bxl(NOON))).toMatchObject({ done: 1, total: 2 })
    d = applyCritterOp(d, { type: 'obtained', id: 'classic-cobra', value: true }, bxl(NOON))
    const s = summarizeToday(d, bxl(NOON))
    expect(ids(s.fed)).toEqual([])
    expect([s.done, s.total]).toEqual([0, 1])
  })

  it('les extensions non possédées sont masquées et ne comptent pas', () => {
    const base = allObtainedExcept(['classic-capybara', 'classic-squirrel', 'classic-hedgehog'])
    // lundi 12 h : écureuil classique 12–24 h, capybara classique toute la journée, hérisson classique toute la journée
    expect(summarizeToday(base, bxl(NOON)).total).toBe(3)
    const noEternity = applyCritterOp(base, { type: 'owned', collection: 'eternity', value: false }, bxl(NOON))
    expect(summarizeToday(noEternity, bxl(NOON)).total).toBe(2)
    const baseOnly = CRITTER_DLC.reduce((d, c) => applyCritterOp(d, { type: 'owned', collection: c, value: false }, bxl(NOON)), base)
    expect(ids(summarizeToday(baseOnly, bxl(NOON)).toFeed)).toEqual(['classic-squirrel'])
    expect(obtainedStats(baseOnly)).toEqual({ obtained: 41 - 1, total: 41 })
    expect(baseOnly.owned).toEqual({ eternity: false, storybook: false, wishblossom: false, honeyglow: false })
  })

  it('les variantes sans horaire connu ou sous condition ne comptent jamais, même nourries', () => {
    const d = run(
      [
        [{ type: 'feed', id: 'white-sweet-bee' }, NOON],
        [{ type: 'feed', id: 'toon-capybara' }, NOON],
      ],
      allObtainedExcept(['white-sweet-bee', 'toon-capybara']),
    )
    const s = summarizeToday(d, bxl(NOON))
    expect([s.done, s.total]).toEqual([0, 0])
    expect(d.progress['toon-capybara']?.feedings).toBe(1) // la progression de la variante, elle, est enregistrée
  })

  it('au passage de minuit, les nourris de la veille redeviennent à nourrir', () => {
    const d = run([[{ type: 'feed', id: 'classic-capybara' }, '2026-11-09T23:50:00']], allObtainedExcept(['classic-capybara']))
    expect(ids(summarizeToday(d, bxl('2026-11-09T23:55:00')).fed)).toEqual(['classic-capybara'])
    const after = summarizeToday(d, bxl('2026-11-10T00:05:00'))
    expect(ids(after.toFeed)).toEqual(['classic-capybara'])
    expect(after.fed).toEqual([])
  })

  it('ligne agrégée : disparaît s’il n’y a rien, « À faire » puis « Terminées »', () => {
    expect(critterTaskOverride(allObtainedExcept([]), bxl(NOON))).toEqual({ state: 'hidden' })
    const base = allObtainedExcept(['classic-capybara', 'golden-goose', 'black-goose'])
    expect(critterTaskOverride(base, bxl(NOON))).toEqual({
      state: 'todo',
      label: '🐾 Animaux à nourrir : 0/2',
      meta: '2 à nourrir · 1 occasion manquée',
      href: '#/collection/animaux/aujourdhui',
    })
    const fed = run(
      [
        [{ type: 'feed', id: 'classic-capybara' }, NOON],
        [{ type: 'feed', id: 'golden-goose' }, NOON],
      ],
      base,
    )
    expect(critterTaskOverride(fed, bxl(NOON))).toMatchObject({ state: 'done', label: '🐾 Animaux à nourrir : 2/2', meta: 'Tout est nourri pour aujourd’hui' })
  })
})
