import { beforeEach, describe, expect, it } from 'vitest'
import { useNps } from './useNps'

// Le NPS ne doit solliciter l'utilisateur qu'une recherche sur 20, et
// jamais deux fois dans le mois. Une erreur ici est invisible en
// développement (on ne fait pas 20 recherches) mais très visible en
// production, sous forme de popup incessante.

const COUNT_KEY = 'docsearch-search-count'
const LAST_SHOWN_KEY = 'docsearch-nps-last-shown'

/** Simule n recherches successives et dit si la popup s'est affichée. */
function afterSearches(n: number, enabled = true): boolean {
  const { visible, maybeShow } = useNps(() => enabled)
  for (let i = 0; i < n; i++) maybeShow()
  return visible.value
}

describe('useNps', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("ne s'affiche pas avant la 20e recherche", () => {
    expect(afterSearches(19)).toBe(false)
  })

  it("s'affiche à la 20e recherche", () => {
    expect(afterSearches(20)).toBe(true)
  })

  it('ne s’affiche pas si la fonctionnalité est désactivée en admin', () => {
    expect(afterSearches(40, false)).toBe(false)
    // Le compteur ne doit alors pas avancer non plus : réactiver la
    // fonctionnalité ne doit pas déclencher la popup immédiatement.
    expect(localStorage.getItem(COUNT_KEY)).toBeNull()
  })

  it('respecte le délai de 30 jours entre deux affichages', () => {
    localStorage.setItem(LAST_SHOWN_KEY, String(Date.now()))
    expect(afterSearches(20)).toBe(false)
  })

  it('se réaffiche une fois le délai écoulé', () => {
    const jours31 = Date.now() - 31 * 24 * 60 * 60 * 1000
    localStorage.setItem(LAST_SHOWN_KEY, String(jours31))
    expect(afterSearches(20)).toBe(true)
  })

  it('mémorise la date du dernier affichage', () => {
    afterSearches(20)
    expect(Number(localStorage.getItem(LAST_SHOWN_KEY))).toBeGreaterThan(0)
  })

  it('poursuit le comptage entre deux sessions', () => {
    // Le compteur est en localStorage : 19 recherches puis un
    // rechargement de page, la 20e doit déclencher la popup.
    localStorage.setItem(COUNT_KEY, '19')
    expect(afterSearches(1)).toBe(true)
  })
})
