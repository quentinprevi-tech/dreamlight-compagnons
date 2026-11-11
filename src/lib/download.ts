/** Fait télécharger un objet sous forme de fichier JSON. */
export function downloadJson(fileName: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  // Laisse au navigateur le temps de démarrer le téléchargement (iOS notamment).
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
