import 'fake-indexeddb/auto'
import { Blob as NodeBlob } from 'node:buffer'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => cleanup())

// Les Blob de jsdom ne survivent pas au clonage de fake-indexeddb (contrairement à un vrai
// navigateur) : on utilise ceux de Node. Le vrai navigateur est couvert par les tests E2E.
globalThis.Blob = NodeBlob as unknown as typeof Blob

// jsdom n'implémente pas ces API
window.scrollTo = () => {}
URL.createObjectURL ??= () => 'blob:test'
URL.revokeObjectURL ??= () => {}
