import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useDialogsStore } from './dialogs'
import { ADMIN_SHORTCUTS, SHORTCUTS, STATS_SHORTCUTS } from '@/constants'

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
    for (const shortcut of [...SHORTCUTS, ...ADMIN_SHORTCUTS]) {
      expect(shortcut.keys.trim()).not.toBe('')
      expect(shortcut.label.trim()).not.toBe('')
    }
  })

  // La palette, l'aide et les infobulles lisent la même liste : une touche
  // en double y passerait inaperçue tout en cassant les clés de rendu.
  it('ne comportent pas de doublon', () => {
    for (const liste of [SHORTCUTS, ADMIN_SHORTCUTS, STATS_SHORTCUTS]) {
      const keys = liste.map((s) => s.keys)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })

  /**
   * La page de statistiques n'a pas de rechargement global : publier
   * « r » y décrirait une touche inopérante — exactement ce que la règle
   * de synchronisation entre liste publiée et touches branchées
   * interdit. « / » et « s » y sont en revanche branchées depuis qu'elle
   * a, elle aussi, un sommaire.
   *
   * Écrit comme une différence d'ensembles et non comme un décompte : un
   * décompte tombe en panne à chaque raccourci ajouté d'un côté ou de
   * l'autre, sans rien dire de ce qui a bougé.
   */
  it('la liste des statistiques omet ce qui n’y est pas branché, sans rien perdre d’autre', () => {
    const propresAdmin = ['r']
    expect(STATS_SHORTCUTS.map((s) => s.keys)).toEqual(
      ADMIN_SHORTCUTS.map((s) => s.keys).filter((k) => !propresAdmin.includes(k)),
    )
  })

  // Une touche partagée entre les deux familles de pages doit y désigner
  // le même geste, sans quoi elle devient un piège.
  it('« t », « h » et « ? » gardent leur sens d’une page à l’autre', () => {
    for (const touche of ['t', 'h', '?']) {
      const recherche = SHORTCUTS.find((s) => s.keys === touche)
      const admin = ADMIN_SHORTCUTS.find((s) => s.keys === touche)
      expect(recherche, `« ${touche} » absente de la recherche`).toBeDefined()
      expect(admin, `« ${touche} » absente de l’administration`).toBeDefined()
    }
    // « a » n'est plus utilisée nulle part : deux touches pour le même
    // geste selon la page était l'incohérence à corriger.
    expect(ADMIN_SHORTCUTS.map((s) => s.keys)).not.toContain('a')
  })
})
