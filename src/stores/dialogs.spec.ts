import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useDialogsStore } from './dialogs'
import { SHORTCUTS } from '@/constants'

describe('confirmations et saisies', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('résout à true puis efface la demande', async () => {
    const dialogs = useDialogsStore()
    const answer = dialogs.ask({
      kind: 'confirm',
      title: 'T',
      message: 'M',
      danger: true,
      confirmLabel: 'Oui',
    })
    expect(dialogs.pending).not.toBeNull()
    dialogs.settle(true)
    await expect(answer).resolves.toBe(true)
    expect(dialogs.pending).toBeNull()
  })

  // Même valeur de repli que les boîtes natives : c'est ce qui permet aux
  // sites d'appel de garder leur forme `if (!(await confirm(…))) return`.
  it('une confirmation annulée vaut false, une saisie annulée vaut null', async () => {
    const dialogs = useDialogsStore()

    const confirmed = dialogs.ask({
      kind: 'confirm',
      title: 'T',
      message: 'M',
      danger: true,
      confirmLabel: 'Oui',
    })
    dialogs.dismiss()
    await expect(confirmed).resolves.toBe(false)

    const typed = dialogs.ask({ kind: 'prompt', title: 'T', message: 'M', initial: 'x' })
    dialogs.dismiss()
    await expect(typed).resolves.toBeNull()
  })

  it('ne laisse aucune promesse en suspens quand rien n’est en attente', () => {
    const dialogs = useDialogsStore()
    expect(() => dialogs.dismiss()).not.toThrow()
    expect(() => dialogs.settle(true)).not.toThrow()
  })
})

describe('raccourcis publiés', () => {
  it('ont tous une touche et un libellé', () => {
    for (const shortcut of SHORTCUTS) {
      expect(shortcut.keys.trim()).not.toBe('')
      expect(shortcut.label.trim()).not.toBe('')
    }
  })

  // La palette, l'aide et les infobulles lisent la même liste : une touche
  // en double y passerait inaperçue tout en cassant les clés de rendu.
  it('ne comportent pas de doublon', () => {
    const keys = SHORTCUTS.map((s) => s.keys)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
