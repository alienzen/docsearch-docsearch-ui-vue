import { describe, expect, it } from 'vitest'
import { fmtDuration } from './format'

// Le formatage est en français : virgule décimale et espace insécable
// devant l'unité viennent de toLocaleString('fr-FR'), pas d'une
// concaténation à la main. Les comparaisons ci-dessous passent donc par
// des expressions régulières tolérantes à la nature exacte de l'espace,
// qui varie d'une version d'ICU à l'autre.

describe('fmtDuration', () => {
  it('exprime en millisecondes en dessous de la seconde', () => {
    expect(fmtDuration(87)).toBe('87 ms')
    expect(fmtDuration(999)).toBe('999 ms')
  })

  // Zéro est une mesure, pas une absence de mesure : Elasticsearch
  // rapporte régulièrement took=0 sur une requête servie depuis son
  // cache, et « — » laisserait croire que rien n'a été mesuré.
  it('affiche zéro comme une durée', () => {
    expect(fmtDuration(0)).toBe('0 ms')
  })

  it('passe à la seconde au-delà de 1000 ms', () => {
    expect(fmtDuration(1000)).toMatch(/^1,00\s?s$/)
    expect(fmtDuration(1237)).toMatch(/^1,24\s?s$/)
  })

  it('arrondit les millisecondes plutôt que d’étaler des décimales', () => {
    expect(fmtDuration(34.5)).toBe('35 ms')
  })

  // La durée est absente des recherches antérieures à la mesure, et
  // `took_ms` peut être null : afficher « 0 ms » à leur place ferait
  // croire à une recherche instantanée.
  it('distingue l’absence de mesure d’une mesure nulle', () => {
    expect(fmtDuration(null)).toBe('—')
    expect(fmtDuration(undefined)).toBe('—')
    expect(fmtDuration(NaN)).toBe('—')
  })
})
