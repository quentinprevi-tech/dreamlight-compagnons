import { useRef, useState } from 'react'
import { CHARACTERS, DATA_VERIFIED_AT, isReleased } from '../data/characters'
import { makeBackup, parseBackup } from '../lib/storage'
import type { Companions } from '../lib/useCompanions'

export function AboutScreen({ companions }: { companions: Companions }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)
  const released = CHARACTERS.filter((c) => isReleased(c)).length
  const upcoming = CHARACTERS.length - released

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(makeBackup(companions.assignments), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dreamlight-compagnons-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const a = parseBackup(await file.text())
      if (!confirm(`Remplacer les métiers actuels par ceux du fichier (${Object.keys(a).length} habitants) ?`)) return
      companions.replaceAll(a)
      setMessage('Sauvegarde restaurée ✓')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Fichier illisible.')
    }
  }

  const card = 'glass rounded-3xl p-5'

  return (
    <div className="animate-fade-up space-y-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <h1 className="text-gold font-magic text-3xl font-bold">Infos</h1>

      <section className={card}>
        <h2 className="font-display text-lg font-bold text-plum-900">💾 Tes données</h2>
        <p className="mt-1 text-sm text-plum-700">
          Tout est enregistré automatiquement sur ce téléphone, sans compte. Pense à exporter une copie de temps en temps : effacer
          les données du navigateur supprimerait aussi tes métiers.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={exportBackup} className="rounded-full bg-plum-700 px-4 py-2 text-sm font-semibold text-white active:scale-95">
            Exporter une copie
          </button>
          <button onClick={() => fileRef.current?.click()} className="rounded-full bg-plum-100 px-4 py-2 text-sm font-semibold text-plum-800 active:scale-95">
            Restaurer
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={importBackup} />
        </div>
        {message && <p className="mt-2 text-sm text-plum-700">{message}</p>}
      </section>

      <section className={card}>
        <h2 className="font-display text-lg font-bold text-plum-900">📚 Personnages</h2>
        <p className="mt-1 text-sm text-plum-700">
          {released} habitants disponibles
          {upcoming > 0 && ` et ${upcoming} annoncés (marqués « Bientôt »)`}. Liste vérifiée le{' '}
          {new Date(`${DATA_VERIFIED_AT}T12:00:00`).toLocaleDateString('fr-FR')} d’après la collection en jeu recensée par le
          Dreamlight Valley Wiki et des guides francophones.
        </p>
        <p className="mt-2 text-sm text-plum-700">
          Les portraits officiels appartiennent à Disney et Gameloft et ne sont pas libres de réutilisation : ils ne sont donc pas
          inclus. Chaque habitant a un médaillon à ses initiales, et tu peux lui donner une vraie image avec « Ajouter une photo »
          (une capture d’écran du jeu, par exemple).
        </p>
      </section>

      <p className="px-2 pb-4 text-center text-xs text-plum-200/70">
        Application non officielle, faite avec amour pour une joueuse de Dreamlight Valley. ✨
      </p>
    </div>
  )
}
