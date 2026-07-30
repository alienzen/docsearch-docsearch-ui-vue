import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * Confirmations et saisies, à la place de `confirm()` et `prompt()`.
 *
 * Les boîtes natives ne sont ni stylables ni thémables — elles restaient
 * blanches en thème sombre — et `prompt()` n'offre aucune validation :
 * `useSourceField` devait vérifier APRÈS coup qu'un libellé n'était pas
 * vide, sans pouvoir redemander.
 *
 * Le store ne garde qu'une demande à la fois. C'est volontaire : les
 * appels natifs qu'il remplace étaient bloquants, donc jamais imbriqués,
 * et une file d'attente inviterait à un enchaînement de fenêtres que
 * personne ne souhaite.
 */

export type ConfirmRequest = {
  kind: 'confirm'
  title: string
  message: string
  /** Style d'alerte DSFR et libellé rouge, pour une action destructrice. */
  danger: boolean
  confirmLabel: string
}

export type PromptRequest = {
  kind: 'prompt'
  title: string
  message: string
  initial: string
  /** Renvoie un message d'erreur, ou null si la valeur convient. */
  validate?: (value: string) => string | null
}

type Pending =
  | (ConfirmRequest & { resolve: (value: boolean) => void })
  | (PromptRequest & { resolve: (value: string | null) => void })

export const useDialogsStore = defineStore('dialogs', () => {
  const pending = ref<Pending | null>(null)

  // Surcharges : l'appelant récupère `boolean` pour une confirmation et
  // `string | null` pour une saisie, sans avoir à affiner lui-même.
  function ask(request: ConfirmRequest): Promise<boolean>
  function ask(request: PromptRequest): Promise<string | null>
  function ask(request: ConfirmRequest | PromptRequest): Promise<boolean | string | null> {
    return new Promise<boolean | string | null>((resolve) => {
      pending.value = { ...request, resolve } as Pending
    })
  }

  /**
   * Rend la main à l'appelant puis efface la demande. L'ordre importe
   * peu ici, mais effacer d'abord perdrait le `resolve` : une promesse
   * jamais résolue laisserait l'appelant suspendu sans erreur visible.
   */
  function settle(value: boolean | string | null) {
    const current = pending.value
    if (!current) return
    ;(current.resolve as (v: unknown) => void)(value)
    pending.value = null
  }

  /** Annulation : même valeur de repli que les boîtes natives. */
  function dismiss() {
    if (!pending.value) return
    settle(pending.value.kind === 'confirm' ? false : null)
  }

  return { pending, ask, settle, dismiss }
})
