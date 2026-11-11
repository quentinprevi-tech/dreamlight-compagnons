// Établit la table « identifiant d'ingrédient -> image du Dreamlight Valley Wiki » (src/features/recipes/ingredientImages.ts).
//
// À lancer à la main, rarement (jamais par l'application, jamais par la CI) :
//   node scripts/resolve-ingredient-images.mjs            -> interroge le wiki puis écrit la table
//   node scripts/resolve-ingredient-images.mjs --from X.json -> réécrit la table depuis un résultat déjà obtenu (aucune requête)
//
// Ce que le script fait, et seulement cela :
// 1. demande au wiki (API MediaWiki, 20 titres par requête, une requête à la fois) l'image principale de la fiche
//    de chaque ingrédient, avec sa vignette de 120 px ;
// 2. vérifie chaque URL avec une requête HEAD (3 en parallèle au plus, pause entre les requêtes, arrêt sur « 429 ») ;
// 3. n'écrit la table que si les 198 contrôles réussissent : fiche trouvée, nom du fichier = nom de l'ingrédient,
//    réponse HTTP 200 de type image/*, aucune image partagée par deux ingrédients.
// Aucune image n'est téléchargée ni copiée dans le dépôt : seules les adresses sont enregistrées.
import { readFileSync, writeFileSync } from 'node:fs'

const ROOT = new URL('../', import.meta.url)
const TABLE = new URL('src/features/recipes/ingredientImages.ts', ROOT)
const UA = 'DreamlightCompagnons-check/1.0 (verification ponctuelle de liens)'
const BASE = 'https://dreamlightvalleywiki.com'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')
const { INGREDIENTS } = await import(new URL('src/features/recipes/catalog.data.ts', ROOT).href)

async function getJson(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (res.status === 429 || res.status >= 500) {
      const wait = Number(res.headers.get('retry-after')) || 5 * (attempt + 1)
      console.error('HTTP', res.status, '— attente', wait, 's')
      await sleep(wait * 1000)
      continue
    }
    if (!res.ok) throw new Error('HTTP ' + res.status)
    return res.json()
  }
  throw new Error('trop d’erreurs côté wiki : on s’arrête')
}

async function fetchResults() {
  const results = {}
  for (let i = 0; i < INGREDIENTS.length; i += 20) {
    const chunk = INGREDIENTS.slice(i, i + 20)
    const titles = chunk.map((x) => x.en).join('|')
    const url = `${BASE}/api.php?action=query&format=json&redirects=1&prop=pageimages&piprop=name|thumbnail|original&pithumbsize=120&titles=${encodeURIComponent(titles)}`
    const { query } = await getJson(url)
    const alias = new Map()
    for (const r of query.redirects ?? []) alias.set(r.from, r.to)
    for (const n of query.normalized ?? []) alias.set(n.from, alias.get(n.from) ?? n.to)
    const pages = Object.values(query.pages)
    for (const ing of chunk) {
      let title = ing.en
      for (let k = 0; k < 3; k++) if (alias.has(title)) title = alias.get(title)
      const page = pages.find((p) => p.title === title)
      results[ing.id] = {
        en: ing.en,
        title: page?.title ?? null,
        missing: !page || 'missing' in page,
        redirected: title !== ing.en,
        pageimage: page?.pageimage ?? null,
        thumb: page?.thumbnail?.source ?? null,
      }
    }
    await sleep(600)
  }
  const ids = Object.keys(results).filter((id) => results[id].thumb)
  let cursor = 0
  let stop = false
  const worker = async () => {
    while (!stop && cursor < ids.length) {
      const r = results[ids[cursor++]]
      try {
        const res = await fetch(r.thumb, { method: 'HEAD', headers: { 'User-Agent': UA } })
        r.http = res.status
        r.type = res.headers.get('content-type')
        if (res.status === 429) {
          stop = true
          console.error('429 : arrêt')
        }
      } catch (e) {
        r.http = 0
        r.error = String(e)
      }
      await sleep(250)
    }
  }
  await Promise.all([worker(), worker(), worker()])
  return results
}

const fromIdx = process.argv.indexOf('--from')
const results = fromIdx > 0 ? JSON.parse(readFileSync(process.argv[fromIdx + 1], 'utf8')) : await fetchResults()

// Contrôles : une table incomplète ou douteuse n'est jamais écrite.
const problems = []
const seen = new Map()
for (const ing of INGREDIENTS) {
  const r = results[ing.id]
  if (!r || r.missing || !r.thumb) problems.push(`${ing.id} : fiche ou image introuvable`)
  else {
    const file = (r.pageimage ?? '').replace(/\.[a-z]+$/i, '')
    if (norm(file) !== norm(ing.en)) problems.push(`${ing.id} : le fichier « ${r.pageimage} » ne porte pas le nom « ${ing.en} »`)
    if (r.redirected) problems.push(`${ing.id} : la fiche est une redirection vers « ${r.title} »`)
    if (r.http !== 200 || !/^image\//.test(r.type ?? '')) problems.push(`${ing.id} : HTTP ${r.http} ${r.type ?? ''}`)
    if (!r.thumb.startsWith(`${BASE}/images/`)) problems.push(`${ing.id} : adresse inattendue ${r.thumb}`)
    if (seen.has(r.thumb)) problems.push(`${ing.id} : même image que ${seen.get(r.thumb)}`)
    seen.set(r.thumb, ing.id)
  }
}
if (problems.length) {
  console.error(`${problems.length} problème(s), table NON écrite :\n- ${problems.join('\n- ')}`)
  process.exit(1)
}

const date = new Date().toISOString().slice(0, 10)
const lines = INGREDIENTS.map((ing) => `  ${JSON.stringify(ing.id)}: ${JSON.stringify(results[ing.id].thumb.slice(`${BASE}/images/`.length))},`)
writeFileSync(
  TABLE,
  `// Fichier GÉNÉRÉ par scripts/resolve-ingredient-images.mjs — ne pas modifier à la main.
// Vignettes des ingrédients : images du Dreamlight Valley Wiki (communautaire, non commercial), adresses relevées
// et vérifiées une à une le ${date} (fiche trouvée, nom du fichier = nom de l'ingrédient, HTTP 200 de type image).
// Les images restent hébergées sur le wiki : elles ne sont PAS copiées dans ce projet.
// Valeur : chemin sous https://dreamlightvalleywiki.com/images/ (vignette de 120 px, ou image d'origine quand elle est plus petite).
// Les droits des visuels appartiennent à Disney et Gameloft.
export const INGREDIENT_IMAGES_VERIFIED = '${date}'

export const INGREDIENT_IMAGE_PATHS: Readonly<Record<string, string>> = {
${lines.join('\n')}
}
`,
)
console.log(`Table écrite : ${INGREDIENTS.length} ingrédients, tous contrôlés (${TABLE.pathname}).`)
