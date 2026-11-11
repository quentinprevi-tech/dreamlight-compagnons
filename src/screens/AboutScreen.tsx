import { useCallback, useEffect, useRef, useState } from 'react'
import { CHARACTERS, DATA_VERIFIED_AT, isReleased } from '../data/characters'
import { RestoreSheet } from '../components/RestoreSheet'
import {
  applyRestore,
  BACKUP_TOO_LARGE,
  backupFileName,
  BackupError,
  createBackup,
  estimatePhotosSize,
  lastRestore,
  MAX_BACKUP_BYTES,
  parseBackupText,
  planRestore,
  undoLastRestore,
  type ParsedBackup,
  type PlanItem,
} from '../lib/backup'
import { downloadJson } from '../lib/download'
import { loadPortraits } from '../lib/storage'
import type { Companions } from '../lib/useCompanions'

const formatSize = (bytes: number) => (bytes < 1_000_000 ? `${Math.max(1, Math.round(bytes / 1000))} Ko` : `${(bytes / 1_000_000).toFixed(1).replace('.', ',')} Mo`)
const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export function AboutScreen({ companions, onRestored }: { companions: Companions; onRestored?: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [includePhotos, setIncludePhotos] = useState(true)
  const [photosSize, setPhotosSize] = useState<number | null>(null)
  const [pending, setPending] = useState<{ parsed: ParsedBackup; plan: PlanItem[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [restoredAt, setRestoredAt] = useState<string | null>(null)
  const released = CHARACTERS.filter((c) => isReleased(c)).length
  const upcoming = CHARACTERS.length - released
  const photoCount = Object.keys(companions.portraits).length

  useEffect(() => {
    let cancelled = false
    loadPortraits()
      .then((p) => !cancelled && setPhotosSize(estimatePhotosSize(Object.values(p))))
      .catch(() => !cancelled && setPhotosSize(null))
    return () => {
      cancelled = true
    }
  }, [companions.portraits])

  const refreshLastRestore = useCallback(() => lastRestore().then((r) => setRestoredAt(r?.at ?? null), () => setRestoredAt(null)), [])
  useEffect(() => {
    void refreshLastRestore()
  }, [refreshLastRestore])

  const exportBackup = async () => {
    try {
      downloadJson(backupFileName(), await createBackup({ includePhotos }))
      setMessage('Copie exportée ✓ Range le fichier en dehors du téléphone.')
    } catch {
      setMessage('L’export a échoué.')
    }
  }

  const chooseFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      setMessage(null)
      // Contrôle sur la taille réelle (octets) AVANT de lire le fichier en mémoire.
      if (file.size > MAX_BACKUP_BYTES) throw new BackupError(BACKUP_TOO_LARGE)
      const parsed = parseBackupText(await file.text())
      setPending({ parsed, plan: await planRestore(parsed) })
    } catch (err) {
      setMessage(err instanceof BackupError ? err.message : 'Fichier illisible.')
    }
  }

  const confirmRestore = async () => {
    if (!pending) return
    setBusy(true)
    try {
      await applyRestore(pending.parsed)
      await companions.afterRestore()
      onRestored?.()
      setMessage('Sauvegarde restaurée ✓')
    } catch (err) {
      setMessage(err instanceof BackupError ? err.message : 'La restauration a échoué. Tes données n’ont pas été modifiées.')
    } finally {
      setBusy(false)
      setPending(null)
      void refreshLastRestore()
    }
  }

  const undoRestore = async () => {
    if (!restoredAt) return
    const question =
      `Revenir à l’état d’avant la restauration du ${formatDateTime(restoredAt)} ?\n\n` +
      'Attention : toutes les modifications faites depuis cette restauration (métiers, photos, noms…) seront perdues.'
    if (!confirm(question)) return
    try {
      await undoLastRestore()
      await companions.afterRestore()
      onRestored?.()
      setMessage('Restauration annulée ✓')
    } catch (err) {
      setMessage(err instanceof BackupError ? err.message : 'L’annulation a échoué.')
    } finally {
      void refreshLastRestore()
    }
  }

  const card = 'glass rounded-3xl p-5'

  return (
    <div className="animate-fade-up space-y-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <h1 className="text-gold font-magic text-3xl font-bold">Infos</h1>

      <section className={card}>
        <h2 className="font-display text-lg font-bold text-plum-900">💾 Tes données</h2>
        <p className="mt-1 text-sm text-plum-700">Tout est enregistré automatiquement sur ce téléphone, sans compte.</p>
        <p className="mt-2 rounded-2xl bg-gold-200/70 p-3 text-sm text-plum-800">
          La seule vraie sauvegarde est le <strong>fichier exporté</strong> : garde-le en dehors du téléphone (mail, cloud,
          ordinateur). Perdre le téléphone ou effacer les données du navigateur efface aussi tout ce qui est dans l’app.
        </p>

        <label className={`mt-3 flex items-center gap-2 text-sm ${photoCount ? 'text-plum-800' : 'text-plum-400'}`}>
          <input
            type="checkbox"
            checked={includePhotos && photoCount > 0}
            disabled={photoCount === 0}
            onChange={(e) => setIncludePhotos(e.target.checked)}
            className="size-5 accent-plum-700"
          />
          {photoCount === 0
            ? 'Aucune photo personnelle à inclure'
            : `${photoCount > 1 ? `Inclure mes ${photoCount} photos` : 'Inclure ma photo'}${photosSize ? ` (≈ ${formatSize(photosSize)})` : ''}`}
        </label>

        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => void exportBackup()} className="rounded-full bg-plum-700 px-4 py-2 text-sm font-semibold text-white active:scale-95">
            Exporter une copie
          </button>
          <button onClick={() => fileRef.current?.click()} className="rounded-full bg-plum-100 px-4 py-2 text-sm font-semibold text-plum-800 active:scale-95">
            Restaurer
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={chooseFile} data-testid="backup-input" />
        </div>
        {message && (
          <p className="mt-2 text-sm text-plum-700" role="status">
            {message}
          </p>
        )}

        {restoredAt && (
          <div className="mt-3 border-t border-plum-100 pt-3 text-sm text-plum-700">
            <p>Dernière restauration : {formatDateTime(restoredAt)}.</p>
            <button onClick={() => void undoRestore()} className="mt-2 rounded-full bg-plum-100 px-4 py-2 font-semibold text-plum-800 active:scale-95">
              Annuler la dernière restauration
            </button>
          </div>
        )}
        <p className="mt-3 text-xs text-plum-500">
          Avant chaque mise à jour des données et chaque restauration, l’app garde aussi une copie de sécurité sur le
          téléphone. Elle protège d’une erreur, pas de la perte du téléphone.
        </p>
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
          Les portraits s’affichent depuis le{' '}
          <a href="https://dreamlightvalleywiki.com/Characters" className="underline" target="_blank" rel="noreferrer">
            Dreamlight Valley Wiki
          </a>{' '}
          (personnages © Disney / Gameloft) et restent en mémoire pour le mode hors ligne. Tu peux remplacer n’importe quel
          portrait par ta propre image en touchant la photo dans la fiche d’un habitant. Les personnages annoncés gardent un
          médaillon à leurs initiales en attendant.
        </p>
      </section>

      <p className="px-2 pb-4 text-center text-xs text-plum-200/70">
        Application non officielle, faite avec amour pour une joueuse de Dreamlight Valley. ✨
      </p>

      {pending && (
        <RestoreSheet parsed={pending.parsed} plan={pending.plan} busy={busy} onConfirm={() => void confirmRestore()} onClose={() => !busy && setPending(null)} />
      )}
    </div>
  )
}
