import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/** Les statistiques du script de génération doivent retomber EXACTEMENT sur les totaux de chaque source. */
describe('rapport de génération', () => {
  const report = readFileSync('scripts/data/recipes-report.md', 'utf-8')
  /** Nombre qui suit le libellé de la ligne commençant par `prefix` (tolère les accents). */
  const after = (prefix: string, nth = 0): number => {
    const line = report.split('\n').find((l) => l.replace(/[^\x20-\x7e]/g, '.').startsWith(prefix))
    if (!line) throw new Error(`ligne « ${prefix} » absente du rapport`)
    return Number([...line.matchAll(/(\d+)/g)][nth][1])
  }

  it('chaque entrée de chaque source est classée sans perte', () => {
    const gamo = after('- Rapproch.es par valeurs num') + after('- Rapproch.es par ingr') + after('- Ambigu') + after('- Sans candidat')
    expect(gamo).toBe(453)
    expect(report).toContain('Total : 453 / 453')
    expect(report).toContain('total 215 / 215')
    expect(report).toContain('Total : 480 / 480')
  })

  it('les trois statuts de noms français totalisent 480 recettes', () => {
    const two = after('- Pr.sent dans deux guides', 0)
    const one = after('- Pr.sent dans un seul guide', 0)
    const en = after('- Anglais')
    expect(two + one + en).toBe(480)
  })
})
