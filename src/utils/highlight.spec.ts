import { describe, expect, it } from 'vitest'
import { parseHighlight, parseHighlights } from './highlight'

describe('parseHighlight', () => {
  it('isole les passages surlignés tels que les émet l’API', () => {
    // search_api.py demande explicitement à Elasticsearch d'émettre
    // <mark class="highlight"> plutôt que le <em> par défaut.
    expect(parseHighlight('le <mark class="highlight">budget</mark> annuel')).toEqual([
      { text: 'le ', marked: false },
      { text: 'budget', marked: true },
      { text: ' annuel', marked: false },
    ])
  })

  it('accepte aussi le <em> par défaut d’Elasticsearch', () => {
    // Pour ne pas dépendre d'un réglage modifiable côté serveur.
    expect(parseHighlight('le <em>budget</em> annuel')).toEqual([
      { text: 'le ', marked: false },
      { text: 'budget', marked: true },
      { text: ' annuel', marked: false },
    ])
  })

  it('gère plusieurs surlignages', () => {
    const fragment = '<mark class="highlight">a</mark> et <mark class="highlight">b</mark>'
    expect(parseHighlight(fragment).filter((s) => s.marked)).toEqual([
      { text: 'a', marked: true },
      { text: 'b', marked: true },
    ])
  })

  it('rend le texte non surligné tel quel', () => {
    expect(parseHighlight('aucun surlignage')).toEqual([
      { text: 'aucun surlignage', marked: false },
    ])
  })

  it('ne traite comme balisage QUE les <em> attendus', () => {
    // Le contenu indexé n'est pas échappé par Elasticsearch : tout
    // autre balisage doit ressortir en texte, pour être échappé par Vue
    // au rendu plutôt qu'interprété comme en vanilla (innerHTML).
    const segments = parseHighlight(
      '<script>alert(1)</script> <mark class="highlight">budget</mark>',
    )
    expect(segments[0]).toEqual({ text: '<script>alert(1)</script> ', marked: false })
    expect(segments[1]).toEqual({ text: 'budget', marked: true })
  })

  it('décode les entités produites par Elasticsearch', () => {
    expect(parseHighlight('R&amp;D')).toEqual([{ text: 'R&D', marked: false }])
  })

  it('assemble plusieurs fragments avec le séparateur habituel', () => {
    const text = parseHighlights(['début', 'fin'])
      .map((s) => s.text)
      .join('')
    expect(text).toBe('début … fin')
  })
})
