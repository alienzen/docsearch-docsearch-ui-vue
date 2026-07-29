import { describe, expect, it } from 'vitest'
import { extList, toArray } from './savedSearches'

// Les recherches enregistrées AVANT le passage à la sélection cumulative
// stockent des chaînes là où on attend désormais des tableaux. Ces
// recherches existent en base chez les utilisateurs : les casser, c'est
// leur faire perdre leur travail sans message d'erreur.

describe('toArray', () => {
  it('laisse un tableau intact', () => {
    expect(toArray(['Dupont', 'Martin'])).toEqual(['Dupont', 'Martin'])
  })

  it('enveloppe une chaîne (ancien format)', () => {
    expect(toArray('Dupont')).toEqual(['Dupont'])
  })

  it('rend un tableau vide pour null, undefined ou chaîne vide', () => {
    expect(toArray(null)).toEqual([])
    expect(toArray(undefined)).toEqual([])
    expect(toArray('')).toEqual([])
  })
})

describe('extList', () => {
  it('laisse un tableau intact', () => {
    expect(extList(['.pdf', '.docx'])).toEqual(['.pdf', '.docx'])
  })

  it('enveloppe une extension unique (ancien format)', () => {
    expect(extList('.pdf')).toEqual(['.pdf'])
  })

  it('traite la chaîne « all » comme une absence de filtre', () => {
    // Valeur par défaut des anciens enregistrements : la conserver
    // filtrerait sur une extension littéralement nommée "all", donc
    // zéro résultat.
    expect(extList('all')).toEqual([])
  })

  it('rend un tableau vide quand rien n’est renseigné', () => {
    expect(extList(undefined)).toEqual([])
    expect(extList('')).toEqual([])
  })
})
