import 'fake-indexeddb/auto'
import { Blob as NodeBlob } from 'node:buffer'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { sheetHistorySettled } from '../lib/sheetHistory'

// Après chaque test, on attend que l'historique du navigateur simulé soit revenu en phase avec les fiches fermées :
// un retrait d'entrée encore en route changerait l'adresse au milieu du test suivant.
afterEach(async () => {
  cleanup()
  await sheetHistorySettled()
})

// Les Blob de jsdom ne survivent pas au clonage de fake-indexeddb (contrairement à un vrai
// navigateur) : on utilise ceux de Node. Le vrai navigateur est couvert par les tests E2E.
globalThis.Blob = NodeBlob as unknown as typeof Blob

// jsdom n'implémente pas ces API
window.scrollTo = () => {}
URL.createObjectURL ??= () => 'blob:test'
URL.revokeObjectURL ??= () => {}
