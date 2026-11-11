import { useState } from 'react'
import { backupFileName, createRescueBackup } from '../lib/backup'
import { downloadJson } from '../lib/download'
import type { LoadError } from '../lib/useCompanions'

/**
 * Affiché quand les données n'ont pas pu être entièrement chargées (ou mises à jour).
 * L'app ne montre alors aucun écran qui pourrait écrire. La copie de secours n'est
 * proposée que si les données sont encore lisibles.
 */
export function LoadErrorScreen({ error }: { error: LoadError }) {
  const [message, setMessage] = useState<string | null>(null)

  const rescue = async () => {
    try {
      downloadJson(`secours-${backupFileName()}`, await createRescueBackup())
      setMessage('Copie de secours téléchargée ✓ Garde-la en dehors du téléphone.')
    } catch {
      setMessage('La copie de secours n’a pas pu être créée : les données ne sont plus lisibles pour le moment.')
    }
  }

  return (
    <div role="alert" className="glass mt-16 rounded-3xl p-5">
      <h1 className="font-display text-xl font-bold text-plum-900">
        {error.kind === 'migration' ? 'La mise à jour de tes données n’a pas pu se terminer' : 'Tes données n’ont pas pu être chargées'}
      </h1>
      {error.readable ? (
        <p className="mt-2 text-sm text-plum-700">
          L’app est mise en pause pour ne rien écrire par-dessus tes données. Réessaie ; si le problème revient, télécharge
          une copie de secours avant toute autre manipulation.
        </p>
      ) : (
        <p className="mt-2 text-sm text-plum-700">
          L’app n’arrive pas à lire ses données sur ce téléphone (stockage bloqué ou plein, navigation privée…). Aucune
          copie de secours ne peut être créée tant qu’elles sont illisibles. N’efface pas les données du navigateur et
          réessaie plus tard.
        </p>
      )}
      <p className="mt-2 text-xs text-plum-500">Détail : {error.detail}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={() => window.location.reload()} className="rounded-full bg-plum-700 px-4 py-2 text-sm font-semibold text-white active:scale-95">
          Réessayer
        </button>
        {error.readable && (
          <button onClick={() => void rescue()} className="rounded-full bg-plum-100 px-4 py-2 text-sm font-semibold text-plum-800 active:scale-95">
            Télécharger une copie de secours
          </button>
        )}
      </div>
      {message && <p className="mt-2 text-sm text-plum-700">{message}</p>}
    </div>
  )
}
