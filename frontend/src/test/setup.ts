import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

/**
 * jsdom n'implémente pas `PointerEvent` : les composants Base UI (Switch, Select,
 * Dialog) construisent l'événement et lèvent « PointerEvent is not a constructor »
 * au premier clic. On le comble par un MouseEvent enrichi des champs pointeur.
 */
const globalWindow = globalThis as typeof globalThis & {
  PointerEvent?: typeof PointerEvent
}

if (typeof globalWindow.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    readonly pointerId: number
    readonly pointerType: string
    readonly isPrimary: boolean

    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params)
      this.pointerId = params.pointerId ?? 0
      this.pointerType = params.pointerType ?? 'mouse'
      this.isPrimary = params.isPrimary ?? true
    }
  }

  globalWindow.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent
}

afterEach(() => {
  cleanup()
})
