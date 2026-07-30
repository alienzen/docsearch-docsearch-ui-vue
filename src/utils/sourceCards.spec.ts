import { afterEach, describe, expect, it } from 'vitest'
import { sourceCardCustom } from './sourceCards'

afterEach(() => {
  delete window.docsearchSourceCards
})

describe('personnalisation des cartes par source', () => {
  it('ne renvoie rien quand aucun registre n’est publié', () => {
    expect(sourceCardCustom('rh')).toBeUndefined()
  })

  it('renvoie les réglages de la source demandée', () => {
    window.docsearchSourceCards = { rh: { badge: 'RH', accent: '#0c447c' } }
    expect(sourceCardCustom('rh')).toEqual({ badge: 'RH', accent: '#0c447c' })
    expect(sourceCardCustom('finance')).toBeUndefined()
  })

  // Un résultat sans source ne doit pas aller chercher la clé "undefined"
  // dans le registre, qu'un fichier mal écrit pourrait avoir définie.
  it('ignore un résultat sans source', () => {
    window.docsearchSourceCards = { undefined: { badge: 'X' } }
    expect(sourceCardCustom(undefined)).toBeUndefined()
    expect(sourceCardCustom('')).toBeUndefined()
  })

  // Le fichier est un script classique : rien ne garantit son exécution
  // avant le premier rendu, d'où une lecture à chaque appel plutôt qu'une
  // capture au chargement du module.
  it('voit un registre publié après le chargement du module', () => {
    expect(sourceCardCustom('rh')).toBeUndefined()
    window.docsearchSourceCards = { rh: { titlePrefix: '[RH] ' } }
    expect(sourceCardCustom('rh')?.titlePrefix).toBe('[RH] ')
  })
})
