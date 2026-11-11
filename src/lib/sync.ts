/**
 * Synchronisation entre onglets (ou fenêtres) de l'app ouverts en même temps.
 *
 * Les écritures sont atomiques et ne portent que sur ce qui change (lecture-
 * modification-écriture) : un onglet ne peut donc pas écraser le travail d'un autre.
 * Ce module sert à ce que chaque onglet AFFICHE l'état réel après une modification
 * ou une restauration faite ailleurs : il relit alors ses données.
 *
 * - BroadcastChannel quand il existe ;
 * - sinon, l'événement `storage` (via une petite clé localStorage de signal) ;
 * - dans tous les cas, relecture quand l'onglet redevient visible (filet de sécurité).
 */

const CHANNEL_NAME = 'dreamlight-compagnons'
export const SIGNAL_KEY = 'dreamlight-compagnons:signal'

export type SyncReason = 'changed' | 'restored'
export type RefreshReason = SyncReason | 'visible'

interface SyncMessage {
  from: string
  reason: SyncReason
  at: number
}

export interface Sync {
  /** Prévient les autres onglets qu'une donnée a changé */
  notify: (reason: SyncReason) => void
  close: () => void
}

function isMessage(v: unknown): v is SyncMessage {
  const m = v as SyncMessage | undefined
  return !!m && typeof m.from === 'string' && (m.reason === 'changed' || m.reason === 'restored')
}

/** Un « onglet » : ses propres messages lui sont ignorés. */
export function createSync(onRefresh: (reason: RefreshReason) => void): Sync {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  const cleanups: (() => void)[] = []
  let channel: BroadcastChannel | undefined

  if (typeof BroadcastChannel === 'function') {
    channel = new BroadcastChannel(CHANNEL_NAME)
    channel.onmessage = (e: MessageEvent) => {
      if (isMessage(e.data) && e.data.from !== id) onRefresh(e.data.reason)
    }
  } else if (typeof window !== 'undefined') {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== SIGNAL_KEY || !e.newValue) return
      try {
        const m: unknown = JSON.parse(e.newValue)
        if (isMessage(m) && m.from !== id) onRefresh(m.reason)
      } catch {
        // signal illisible : ignoré
      }
    }
    window.addEventListener('storage', onStorage)
    cleanups.push(() => window.removeEventListener('storage', onStorage))
  }

  if (typeof document !== 'undefined') {
    const onVisible = () => document.visibilityState === 'visible' && onRefresh('visible')
    document.addEventListener('visibilitychange', onVisible)
    cleanups.push(() => document.removeEventListener('visibilitychange', onVisible))
  }

  return {
    notify(reason) {
      const message: SyncMessage = { from: id, reason, at: Date.now() }
      if (channel) {
        channel.postMessage(message)
        return
      }
      try {
        localStorage.setItem(SIGNAL_KEY, JSON.stringify(message))
      } catch {
        // localStorage indisponible : les autres onglets se mettront à jour en redevenant visibles.
      }
    },
    close() {
      channel?.close()
      cleanups.forEach((fn) => fn())
    },
  }
}
