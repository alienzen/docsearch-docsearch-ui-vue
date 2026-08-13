import { beforeEach, describe, expect, it, vi } from 'vitest'
import { trackClick } from './engagement'

// Le suivi de clic écrit dans le journal de recherche, qui sert ensuite
// à mesurer ce que les gens ouvrent et à quel rang. Ce qui se vérifie
// ici est donc l'inverse de l'habituel : ce qu'il ne doit PAS écrire.
// Une position inventée s'agrégerait comme une position réelle, et rien
// à l'écran ne dirait qu'elle est fausse.

describe('trackClick', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
    vi.stubGlobal('fetch', fetchMock)
  })

  it('journalise le rang du document dans la liste affichée', () => {
    trackClick('sid-1', 'doc-a', 0)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/click')
    expect(JSON.parse(init.body as string)).toEqual({
      search_id: 'sid-1',
      doc_id: 'doc-a',
      position: 0,
    })
  })

  it('n’écrit rien sans recherche à laquelle rattacher le clic', () => {
    trackClick(null, 'doc-a', 0)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  // Cas d'origine : un clic sur un résultat épinglé, absent de la liste
  // des identifiants, partait avec la position -1 rendue par indexOf.
  it('n’écrit rien quand la position est inconnue', () => {
    trackClick('sid-1', 'doc-a', -1)

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
