#!/usr/bin/env python3
"""
Génère le catalogue des recettes à partir des données sources figées dans scripts/data :

- wiki-cooking.txt  : catalogue MAÎTRE (480 recettes, extrait du wiki le 2026-11-09, format compact)
- gamosaurus.json   : 453 entrées (noms français, ingrédients, énergie, prix)
- gameblog.json     : 215 entrées (noms français, ingrédients, prix minimal)
- wiki-pages.txt    : une ligne par recette (même ordre) relevée sur la FICHE de chaque recette du wiki :
                      type, collection, prix et énergie, suffixe « + » = la fiche dit « or more » (valeur minimale).
                      Sert de contrôle indépendant du tableau (les nombres doivent être identiques) et de
                      source du statut minimum / exact.

Sorties :
- src/features/recipes/catalog.data.ts : catalogue complet (chargé à la demande par l'application)
- src/features/recipes/ids.ts          : identifiants seuls (léger, chargé dans le paquet principal)
- scripts/data/recipes-report.md       : statistiques, qui doivent retomber EXACTEMENT sur les totaux des sources

Usage : python scripts/build-recipes.py
Règles : aucune correspondance forcée ; chaque entrée de chaque source est classée dans une et une seule catégorie.
"""
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'scripts' / 'data'
OUT = ROOT / 'src' / 'features' / 'recipes'
VERIFIED = '2026-11-09'


def norm(s: str) -> str:
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]+', ' ', s.lower().replace('œ', 'oe')).strip()


def slugify(s: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', norm(s)).strip('-')


GROUP_IDS = ['fruit', 'grain', 'dairy-oil', 'fish', 'protein', 'seafood', 'spice', 'sweet', 'vegetable', 'ice', 'meat']
GROUP_EN = ['Fruit', 'Grains', 'Dairy and Oil', 'Fish', 'Protein', 'Seafood', 'Spices', 'Sweets', 'Vegetables', 'Ice', 'Meats']
GROUP_FR = ['Fruit', 'Céréale', 'Produit laitier ou huile', 'Poisson', 'Protéine', 'Fruit de mer', 'Épice', 'Aliment sucré', 'Légume', 'Glace', 'Viande']
# Étiquettes françaises des guides pour un groupe « au choix » (ne sert qu'à rapprocher les recettes)
GUIDE_GROUP = {
    'legume': 8, 'legumes': 8, 'fruit': 0, 'fruits': 0, 'epice': 6, 'epices': 6, 'poisson': 3, 'fruit de mer': 5, 'fruits de mer': 5,
    'aliment sucre': 7, 'sucrerie': 7, 'cereale': 1, 'produit laitier': 2, 'viande': 10,
}
TYPE_CODE = {'appetizer': 'a', 'entree': 'e', 'dessert': 'd'}
TYPE_NAME = {'a': 'appetizer', 'e': 'entree', 'd': 'dessert'}
COL_NAME = {'b': 'base', 'r': 'eternity', 's': 'storybook', 'w': 'wishblossom', 'h': 'honeyglow'}

# ---------------------------------------------------------------- wiki (catalogue maître)
raw = (DATA / 'wiki-cooking.txt').read_text(encoding='utf-8').split('\n')
ING_SLUGS = raw[raw.index('#I') + 1].split(';')
GROUP_MEMBERS_RAW = raw[raw.index('#G') + 1].split('/')
rows = [x.split('|') for x in raw[raw.index('#R') + 1:] if x]

ingredients = {}  # slug -> {id, en}
for slug in ING_SLUGS:
    ingredients[slug] = {'id': slugify(slug), 'en': slug.replace('_', ' ')}
assert len({v['id'] for v in ingredients.values()}) == len(ingredients), 'identifiants d’ingrédients en double'

W = []
for x in rows:
    slots = []
    for tok in x[7].split(','):
        q = 1
        if '*' in tok:
            tok, q = tok.split('*')
            q = int(q)
        if tok[0] == 'i':
            slots.append({'k': 'f', 'i': ING_SLUGS[int(tok[1:], 36)], 'q': q})
        else:
            g, only = tok[1:].split('=')
            slot = {'k': 'c', 'g': int(g), 'q': q}
            if only:
                slot['only'] = [ING_SLUGS[int(n, 36)] for n in only.split('.')]
            slots.append(slot)
    en = x[1]
    W.append({'en': en, 'id': slugify(en), 'type': x[2], 'stars': int(x[3]), 'energy': int(x[4]), 'price': int(x[5]), 'col': x[6], 'slots': slots})
assert len(W) == 480, f'{len(W)} recettes au lieu de 480'
assert len({w['id'] for w in W}) == 480, 'identifiants de recettes en double'

# ---------------------------------------------------------------- fiches individuelles du wiki (contrôle + minima)
PAGES = [l.split('|') for l in (DATA / 'wiki-pages.txt').read_text(encoding='utf-8').splitlines() if l]
assert len(PAGES) == 480, len(PAGES)
PAGE_COL = {'d': 'b', 'e': 'r', 's': 's', 'w': 'w', 'h': 'h'}
for w, (tc, sell, en) in zip(W, PAGES):
    got = (tc[0], PAGE_COL[tc[1]], int(sell.rstrip('+')), int(en.rstrip('+')))
    assert got == (w['type'], w['col'], w['price'], w['energy']), f'{w["en"]} : tableau et fiche du wiki divergent {got}'
    w['sell_min'], w['energy_min'] = sell.endswith('+'), en.endswith('+')

# ---------------------------------------------------------------- sources françaises
G = json.loads((DATA / 'gamosaurus.json').read_text(encoding='utf-8'))
B = json.loads((DATA / 'gameblog.json').read_text(encoding='utf-8'))
assert len(G) == 453 and len(B) == 215, (len(G), len(B))


def parse_gamo(o):
    items = []
    for s in o['ing']:
        m = re.match(r'^(\d+)\s+(.*)$', s)
        q = int(m.group(1)) if m else 1
        n = (m.group(2) if m else s).strip()
        ch = re.match(r'^(.*?)\s+au choix(?:\s+parmi\s+(.*))?$', n)
        base = norm(ch.group(1)) if ch else norm(n)
        if base in GUIDE_GROUP:
            items.append(('g', GUIDE_GROUP[base], q))
        else:
            items.append(('i', norm(n), q))
    return items


def parse_blog(o):
    items = []
    for tok in o['ing'].split(' + '):
        n = norm(tok)
        items.append(('g', GUIDE_GROUP[n]) if n in GUIDE_GROUP else ('i', n))
    return items


for o in G:
    o['p'] = parse_gamo(o)
for o in B:
    o['p'] = parse_blog(o)

FR2EN = {}  # nom français normalisé -> slug d'ingrédient (appris par recoupement, jamais forcé)
FR_SOURCE = defaultdict(set)  # slug -> guides qui emploient ce nom
FR_TEXT = {}  # nom normalisé -> graphie du guide


def w_fixed(w):
    return {s['i']: s['q'] for s in w['slots'] if s['k'] == 'f'}


def learn(pairs):
    """Élimination : quand il ne reste qu'un ingrédient inconnu de chaque côté (même quantité)."""
    changed = True
    while changed:
        changed = False
        for items, w, qty in pairs:
            gf = [(it[1], it[2] if qty else 1) for it in items if it[0] == 'i' and it[1] not in FR2EN]
            wf = [(s, q if qty else 1) for s, q in w_fixed(w).items() if s not in FR2EN.values()]
            if len(gf) == 1 and len(wf) == 1 and gf[0][1] == wf[0][1]:
                FR2EN[gf[0][0]] = wf[0][0]
                changed = True


def sig_w(w, qty):
    groups = Counter((s['g'], s['q'] if qty else 1) for s in w['slots'] if s['k'] == 'c')
    return groups, sorted((s['q'] if qty else 1) for s in w['slots'] if s['k'] == 'f')


def sig_g(items, qty):
    groups = Counter((it[1], it[2] if qty else 1) for it in items if it[0] == 'g')
    return groups, sorted((it[2] if qty else 1) for it in items if it[0] == 'i')


def compat(items, w, qty):
    gg, gi = sig_g(items, qty)
    wg, wi = sig_w(w, qty)
    if not qty:
        gg, wg = Counter(k[0] for k in gg), Counter(k[0] for k in wg)
        gi, wi = [1] * len(gi), [1] * len(wi)
        # sans quantités : on compare les ensembles distincts
        gi = len({it[1] for it in items if it[0] == 'i'})
        wi = len(w_fixed(w))
        gg = set(it[1] for it in items if it[0] == 'g')
        wg = set(s['g'] for s in w['slots'] if s['k'] == 'c')
    if gg != wg or gi != wi:
        return False
    wf = w_fixed(w)
    for it in items:
        if it[0] == 'i' and it[1] in FR2EN:
            if FR2EN[it[1]] not in wf:
                return False
            if qty and wf[FR2EN[it[1]]] != it[2]:
                return False
    return True


# ---- Gamosaurus -> wiki
gmatch = {}  # index G -> (w, méthode)
wk = defaultdict(list)
for w in W:
    wk[(w['type'], w['stars'], w['energy'], w['price'])].append(w)
ga = defaultdict(list)
for i, o in enumerate(G):
    ga[(TYPE_CODE[o['type']], o['stars'], int(o['energy']), int(o['price']))].append(i)
for key, idxs in ga.items():
    if len(idxs) == 1 and len(wk.get(key, [])) == 1:
        gmatch[idxs[0]] = (wk[key][0], 'numérique')
learn([(G[i]['p'], w, True) for i, (w, _) in gmatch.items()])

while True:
    used = {w['id'] for w, _ in gmatch.values()}
    cand = {}
    for i, o in enumerate(G):
        if i in gmatch:
            continue
        c = [w for w in W if w['id'] not in used and w['type'] == TYPE_CODE[o['type']] and w['stars'] == o['stars'] and compat(o['p'], w, True)]
        if len(c) == 1:
            cand[i] = c[0]
    inv = Counter(w['id'] for w in cand.values())
    new = {i: (w, 'ingrédients') for i, w in cand.items() if inv[w['id']] == 1}
    if not new:
        break
    gmatch.update(new)
    learn([(G[i]['p'], w, True) for i, (w, _) in gmatch.items()])

g_status = {}
for i, o in enumerate(G):
    if i in gmatch:
        g_status[i] = 'rapprochée (' + gmatch[i][1] + ')'
    else:
        n = sum(1 for w in W if w['id'] not in {x['id'] for x, _ in gmatch.values()} and w['type'] == TYPE_CODE[o['type']] and w['stars'] == o['stars'] and compat(o['p'], w, True))
        g_status[i] = 'ambiguë' if n > 1 else 'sans candidat'

# ---- Gameblog -> wiki
bmatch = {}
learn_b = []
while True:
    cand = {}
    for i, o in enumerate(B):
        if i in bmatch:
            continue
        used = {w['id'] for w, _ in bmatch.values()}
        c = [w for w in W if w['id'] not in used and w['type'] == TYPE_CODE[o['type']] and w['stars'] == o['stars'] and compat(o['p'], w, False)]
        # même prix, ou prix du guide Gamosaurus déjà rapproché de la même recette
        c = [w for w in c if str(w['price']) == o['price'] or any(gm[0]['id'] == w['id'] and G[gi]['price'] == o['price'] for gi, gm in gmatch.items())]
        if len(c) == 1:
            cand[i] = c[0]
    inv = Counter(w['id'] for w in cand.values())
    new = {i: (w, 'prix + ingrédients') for i, w in cand.items() if inv[w['id']] == 1}
    if not new:
        break
    bmatch.update(new)
    learn([([('i', it[1], 1) if it[0] == 'i' else ('g', it[1], 1) for it in B[i]['p']], w, False) for i, (w, _) in bmatch.items()])

b_status = {}
for i, o in enumerate(B):
    if i in bmatch:
        b_status[i] = 'rapprochée'
    else:
        used = {w['id'] for w, _ in bmatch.values()}
        n = sum(1 for w in W if w['id'] not in used and w['type'] == TYPE_CODE[o['type']] and w['stars'] == o['stars'] and compat(o['p'], w, False) and str(w['price']) == o['price'])
        b_status[i] = 'ambiguë' if n > 1 else 'sans candidat'

# ---------------------------------------------------------------- noms français par recette
by_w_gamo = {w['id']: G[i] for i, (w, _) in gmatch.items()}
by_w_blog = {w['id']: B[i] for i, (w, _) in bmatch.items()}

# noms d'ingrédients : une graphie par ingrédient ; « deux guides » si les deux listes l'emploient pour des recettes rapprochées
en2fr = {}
for fr, en in FR2EN.items():
    en2fr.setdefault(en, set()).add(fr)
ing_fr = {}
for slug in ING_SLUGS:
    cands = en2fr.get(slug, set())
    if len(cands) != 1:
        ing_fr[slug] = (None, 'en-only')
        continue
    fr = next(iter(cands))
    in_gamo = any(it[0] == 'i' and it[1] == fr for i in gmatch for it in G[i]['p'])
    in_blog = any(it[0] == 'i' and it[1] == fr for i in bmatch for it in B[i]['p'])
    ing_fr[slug] = (fr, 'two-guides' if in_gamo and in_blog else 'one-guide')
# graphies d'origine (accents) : on reprend celle de Gamosaurus, sinon celle de Gameblog
graph = {}
for o in G:
    for s in o['ing']:
        m = re.match(r'^(\d+)\s+(.*)$', s)
        n = (m.group(2) if m else s).strip()
        graph.setdefault(norm(n), n)
for o in B:
    for tok in o['ing'].split(' + '):
        graph.setdefault(norm(tok), tok.strip())

recipes = []
for w in W:
    g = by_w_gamo.get(w['id'])
    b = by_w_blog.get(w['id'])
    fr, status, alt, notes = None, 'en-only', None, []
    if g and b and norm(g['fr']) == norm(b['fr']):
        fr, status = g['fr'], 'two-guides'
    elif g and b:
        fr, status, alt = g['fr'], 'one-guide', b['fr']
        notes.append(f'Noms différents selon les guides : « {g["fr"]} » (Gamosaurus) et « {b["fr"]} » (Gameblog).')
    elif g:
        fr, status = g['fr'], 'one-guide'
    elif b:
        fr, status = b['fr'], 'one-guide'

    def value(wv, is_min, gv, bv):
        # k : « min » si la fiche du wiki dit « or more » (valeur la plus basse possible), « exact » sinon.
        # Aucun minimum n'est présenté comme exact : « exact » n'est affirmé que quand la fiche ne dit pas « or more ».
        others = [x for x in (gv, bv) if x is not None]
        k = 'min' if is_min else 'exact'
        if not others:
            return {'v': wv, 'k': k, 's': 'wiki-only'}
        diff = [x for x in others if x != wv]
        return {'v': wv, 'k': k, 's': 'differs', 'alt': diff[0]} if diff else {'v': wv, 'k': k, 's': 'agree'}

    energy = value(w['energy'], w['energy_min'], int(g['energy']) if g else None, None)
    sell = value(w['price'], w['sell_min'], int(g['price']) if g else None, int(b['price']) if b else None)
    if energy['s'] == 'differs':
        notes.append(f'Énergie : le catalogue donne {w["energy"]}, Gamosaurus {energy["alt"]}.')
    if sell['s'] == 'differs':
        notes.append(f'Prix de vente : le catalogue donne {w["price"]}, un guide {sell["alt"]}.')
    slots = []
    for s in w['slots']:
        if s['k'] == 'f':
            slots.append({'k': 'f', 'i': ingredients[s['i']]['id'], 'q': s['q']})
        else:
            sl = {'k': 'c', 'g': GROUP_IDS[s['g']], 'q': s['q']}
            if 'only' in s:
                sl['only'] = [ingredients[x]['id'] for x in s['only']]
            slots.append(sl)

    rec = {'id': w['id'], 'en': w['en'], 'fr': fr, 'frStatus': status, 'type': TYPE_NAME[w['type']], 'stars': w['stars'], 'collection': COL_NAME[w['col']], 'slots': slots, 'energy': energy, 'sell': sell}
    if alt:
        rec['frAlt'] = alt
    if notes:
        rec['notes'] = notes
    recipes.append(rec)

ing_records = []
for slug in ING_SLUGS:
    fr, st = ing_fr[slug]
    ing_records.append({'id': ingredients[slug]['id'], 'en': ingredients[slug]['en'], 'fr': graph.get(fr) if fr else None, 'frStatus': st})

# ---- groupes : source unique des membres
members = [[ING_SLUGS[int(n, 36)] for n in part.split(',') if n] for part in GROUP_MEMBERS_RAW]  # 10 colonnes du wiki
group_records = []
for k, gid in enumerate(GROUP_IDS):
    if k < 10:
        mem = [ingredients[s]['id'] for s in members[k]]
        rec = {'id': gid, 'en': GROUP_EN[k], 'fr': GROUP_FR[k], 'members': mem}
    else:
        mem = [ingredients[s]['id'] for s in ('Pork', 'Poultry', 'Venison')]
        rec = {'id': gid, 'en': GROUP_EN[k], 'fr': GROUP_FR[k], 'members': mem, 'confirmed': False, 'note': 'Le wiki ne détaille pas « Any Meat » : composition déduite (porc, volaille, gibier), NON vérifiée. À confirmer.'}
    group_records.append(rec)

# « Any Ice » n'a qu'un membre (Slush Ice) et la fiche de la recette liste cet ingrédient : place fixe
ice_members = next(g for g in group_records if g['id'] == 'ice')['members']
assert len(ice_members) == 1
for r in recipes:
    for k, s in enumerate(r['slots']):
        if s['k'] == 'c' and s['g'] == 'ice' and 'only' not in s:
            r['slots'][k] = {'k': 'f', 'i': ice_members[0], 'q': s['q']}
            r.setdefault('notes', []).append('Le tableau du wiki indique « Any Ice » ; sa fiche liste Glace pilée, seul membre du groupe : traité comme ingrédient fixe.')

# ---------------------------------------------------------------- contrôles d'intégrité (le script échoue sinon)
ing_ids = {r['id'] for r in ing_records}
assert len(recipes) == 480 and len({r['id'] for r in recipes}) == 480
cnt = Counter((r['collection'], r['type']) for r in recipes)
col = Counter(r['collection'] for r in recipes)
assert col == {'base': 219, 'eternity': 117, 'storybook': 96, 'wishblossom': 36, 'honeyglow': 12}, col
for r in recipes:
    assert 1 <= len(r['slots']) <= 5, r['id']
    assert all(s['q'] >= 1 for s in r['slots'])
    for s in r['slots']:
        if s['k'] == 'f':
            assert s['i'] in ing_ids, (r['id'], s)
        else:
            assert s['g'] in GROUP_IDS
            for x in s.get('only', []):
                assert x in ing_ids
    assert (r['fr'] is None) == (r['frStatus'] == 'en-only')
for gr in group_records:
    assert all(m in ing_ids for m in gr['members'])
# restrictions « only » : chaque ingrédient autorisé doit appartenir au groupe
for r in recipes:
    for s in r['slots']:
        if s['k'] == 'c' and 'only' in s:
            gm = next(g for g in group_records if g['id'] == s['g'])['members']
            missing = [x for x in s['only'] if x not in gm]
            if missing:
                r.setdefault('notes', []).append(f'Choix restreint à des ingrédients hors du groupe du wiki : {", ".join(missing)}.')
# nombre de places (quantités cumulées) : au plus 5 sauf exceptions documentées
over = [r['id'] for r in recipes if sum(s['q'] for s in r['slots']) > 5]
assert not over, over

# ---------------------------------------------------------------- statistiques (qui doivent retomber sur les totaux)
gc = Counter(g_status.values())
gm_method = Counter(m for _, m in gmatch.values())
bc = Counter(b_status.values())
fr_c = Counter(r['frStatus'] for r in recipes)
assert sum(gc.values()) == 453 and sum(bc.values()) == 215 and sum(fr_c.values()) == 480
assert len(gmatch) == 453 - gc['ambiguë'] - gc['sans candidat']
two = [r for r in recipes if r['frStatus'] == 'two-guides']
one_g = sum(1 for r in recipes if r['frStatus'] == 'one-guide' and r['id'] in by_w_gamo and r['id'] not in by_w_blog)
one_b = sum(1 for r in recipes if r['frStatus'] == 'one-guide' and r['id'] in by_w_blog and r['id'] not in by_w_gamo)
one_both_diff = sum(1 for r in recipes if r['frStatus'] == 'one-guide' and r['id'] in by_w_blog and r['id'] in by_w_gamo)
assert len(two) + one_g + one_b + one_both_diff + fr_c['en-only'] == 480
by_col = defaultdict(Counter)
for r in recipes:
    by_col[r['collection']][r['frStatus']] += 1
ing_c = Counter(r['frStatus'] for r in ing_records)
vs = Counter((r['energy']['s'], r['sell']['s']) for r in recipes)
kinds = Counter((r['energy']['k'], r['sell']['k']) for r in recipes)
assert sum(kinds.values()) == 480
choice = sum(1 for r in recipes if any(s['k'] == 'c' for s in r['slots']))

lines = [
    '# Rapport de génération du catalogue des recettes',
    '',
    f'Données figées le {VERIFIED}. Généré par `scripts/build-recipes.py` (ne pas éditer à la main).',
    '',
    '## Périmètre des contrôles (à lire avant de se fier aux données)',
    "- **Contrôlé sur les 480 fiches individuelles du wiki** (`wiki-pages.txt`, comparée au tableau maître par ce script, 0 écart exigé) : type, collection, prix de vente, énergie et statut minimum / exact. Ces deux transcriptions sont conservées dans le dépôt ; leur fidélité au wiki en ligne n'est pas rejouée par le script.",
    "- **Contrôlé sur un échantillon de 30 recettes seulement** (6 par extension, dont 3 avec choix et 3 sans, comparées à leur fiche) : les ingrédients (29 identiques sur 30 ; écart connu : Plain Snow Cones, traité par une note), ainsi que les noms français et les valeurs des guides pour cet échantillon. Cet échantillon n'est PAS une validation des ingrédients des 480 recettes.",
    "- **Ingrédients des autres recettes : non contrôlés individuellement.** L'appariement avec les guides utilise les ingrédients comme critère : il ne constitue donc pas une validation indépendante.",
    "- La liste exacte des 30 recettes de l'échantillon n'est pas conservée dans le dépôt : ce contrôle n'est pas rejouable à l'identique.",
    "- Rien n'a été vérifié en jeu : noms français, valeurs et compositions restent ceux des sources consultées (wiki, guides).",
    '',
    '## Catalogue maître (wiki)',
    f'- Recettes : {len(recipes)} (base {col["base"]}, A Rift in Time {col["eternity"]}, Storybook Vale {col["storybook"]}, Wishblossom Ranch {col["wishblossom"]}, Honeyglow Woods {col["honeyglow"]}).',
    f'- Ingrédients : {len(ing_records)} ; groupes « au choix » : {len(group_records)} ; recettes avec au moins un choix : {choice}.',
    '',
    '## Gamosaurus : 453 entrées classées sans perte',
    f'- Rapprochées par valeurs numériques uniques : {gm_method["numérique"]}',
    f'- Rapprochées par ingrédients (candidat unique des deux côtés) : {gm_method["ingrédients"]}',
    f'- Ambiguës (laissées sans correspondance) : {gc["ambiguë"]}',
    f'- Sans candidat : {gc["sans candidat"]}',
    f'- Total : {gm_method["numérique"] + gm_method["ingrédients"] + gc["ambiguë"] + gc["sans candidat"]} / 453',
    '',
    '## Gameblog : 215 entrées classées sans perte',
    f'- Rapprochées : {bc["rapprochée"]} ; ambiguës : {bc["ambiguë"]} ; sans candidat : {bc["sans candidat"]} ; total {sum(bc.values())} / 215',
    '',
    '## Noms français des 480 recettes',
    f'- Présent dans deux guides (même nom, sans prétendre à deux vérifications indépendantes) : {len(two)}',
    f'- Présent dans un seul guide : {fr_c["one-guide"]} (Gamosaurus seul {one_g}, Gameblog seul {one_b}, deux guides aux noms différents {one_both_diff})',
    f'- Anglais « À confirmer » : {fr_c["en-only"]}',
    f'- Total : {sum(fr_c.values())} / 480',
    '',
    '| Collection | Deux guides | Un guide | Anglais |',
    '|---|---|---|---|',
]
for c in ('base', 'eternity', 'storybook', 'wishblossom', 'honeyglow'):
    lines.append(f'| {c} | {by_col[c]["two-guides"]} | {by_col[c]["one-guide"]} | {by_col[c]["en-only"]} |')
lines += [
    '',
    '## Ingrédients : noms français',
    f'- Deux guides : {ing_c["two-guides"]} ; un guide : {ing_c["one-guide"]} ; anglais : {ing_c["en-only"]} ; total {sum(ing_c.values())} / {len(ing_records)}',
    '',
    '## Valeurs (énergie / prix de vente, statuts indépendants)',
]
for (e, s), n in sorted(vs.items()):
    lines.append(f'- énergie {e} / prix {s} : {n}')
lines += ['', '## Minima publiés (fiche de chaque recette du wiki : « or more »)']
for (e, s), n in sorted(kinds.items()):
    lines.append(f'- énergie {e} / prix {s} : {n}')
lines += ['', '## Entrées Gamosaurus non rapprochées (pour contrôle)', '']
for i, o in enumerate(G):
    if i not in gmatch:
        lines.append(f'- {o["fr"]} ({o["type"]}, {o["stars"]}★, {o["energy"]}/{o["price"]}) : {g_status[i]}')
lines += ['', '## Entrées Gameblog non rapprochées', '']
for i, o in enumerate(B):
    if i not in bmatch:
        lines.append(f'- {o["fr"]} ({o["type"]}, {o["stars"]}★, prix {o["price"]}) : {b_status[i]}')
(DATA / 'recipes-report.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')

# ---------------------------------------------------------------- fichiers TypeScript
OUT.mkdir(parents=True, exist_ok=True)
header = '// Fichier GÉNÉRÉ par scripts/build-recipes.py — ne pas modifier à la main.\n'
ids_ts = (
    header
    + f'// Identifiants seuls : valident les sauvegardes et les noms sans charger tout le catalogue.\nexport const RECIPE_IDS: readonly string[] = {json.dumps([r["id"] for r in recipes])}\n\n'
    + f'export const INGREDIENT_IDS: readonly string[] = {json.dumps([r["id"] for r in ing_records])}\n'
)
(OUT / 'ids.ts').write_text(ids_ts, encoding='utf-8')
data_ts = (
    header
    + "import type { GroupRecord, IngredientRecord, RecipeRecord } from './types'\n\n"
    + f"/** Date de figement des données sources */\nexport const RECIPES_VERIFIED = '{VERIFIED}'\n\n"
    + f'export const GROUPS: GroupRecord[] = {json.dumps(group_records, ensure_ascii=False)}\n\n'
    + f'export const INGREDIENTS: IngredientRecord[] = {json.dumps(ing_records, ensure_ascii=False)}\n\n'
    + f'export const RECIPES: RecipeRecord[] = {json.dumps(recipes, ensure_ascii=False)}\n'
)
(OUT / 'catalog.data.ts').write_text(data_ts, encoding='utf-8')
print('\n'.join(lines[:44]))
