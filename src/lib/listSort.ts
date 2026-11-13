/** Sens d'un tri : `asc` = A → Z ou du plus faible au plus élevé ; `desc` = l'inverse. */
export type SortDirection = 'asc' | 'desc'

/** Comparaison de noms en français : insensible aux accents et à la casse (« Élan » après « Eau »). */
export const compareNames = (a: string, b: string): number => a.localeCompare(b, 'fr', { sensitivity: 'base' })
