import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from './client'

function repondre(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status < 400,
      status,
      json: async () => body,
    }),
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('message d’erreur de l’API', () => {
  it('reprend le detail quand c’est une chaîne', async () => {
    repondre(400, { detail: "Poids invalide pour 'search_boost_keywords'." })
    await expect(api('/x')).rejects.toThrow("Poids invalide pour 'search_boost_keywords'.")
  })

  /**
   * Le cas qui a coûté un débogage : une erreur de validation FastAPI
   * renvoie une LISTE d'objets, que le message affichait « [object
   * Object] » — illisible, donc impossible à diagnostiquer depuis l'écran.
   */
  it('met une erreur de validation FastAPI en phrase lisible', async () => {
    repondre(422, {
      detail: [{ loc: ['body', 'value'], msg: 'Input should be a valid string', type: 'string_type' }],
    })
    await expect(api('/x')).rejects.toThrow('value : Input should be a valid string')
  })

  it('se replie sur le code HTTP quand le corps est inexploitable', async () => {
    repondre(500, {})
    await expect(api('/x')).rejects.toThrow('Erreur 500')
  })

  it('expose le code HTTP, dont plusieurs écrans se servent', async () => {
    repondre(403, { detail: 'Interdit' })
    await expect(api('/x')).rejects.toBeInstanceOf(ApiError)
    await api('/x').catch((e) => expect(e.status).toBe(403))
  })
})

describe('session expirée', () => {
  /** Réponses successives : une par appel de fetch, dans l'ordre. */
  function enchainer(...reponses: { status: number; body?: unknown }[]) {
    const faux = vi.fn()
    for (const { status, body } of reponses) {
      faux.mockResolvedValueOnce({ ok: status < 400, status, json: async () => body ?? {} })
    }
    vi.stubGlobal('fetch', faux)
    return faux
  }

  it('renouvelle la session puis rejoue l’appel', async () => {
    const faux = enchainer(
      { status: 401 },                    // l'appel initial
      { status: 200 },                    // /auth/refresh
      { status: 200, body: { ok: true } },// le rejeu
    )
    await expect(api('/search')).resolves.toEqual({ ok: true })
    expect(faux.mock.calls[1][0]).toBe('/auth/refresh')
  })

  it('ne rejoue qu’une fois', async () => {
    // Sans le garde-fou, un 401 persistant boucle indéfiniment entre
    // l'appel et son renouvellement.
    const faux = enchainer(
      { status: 401 },
      { status: 200 },
      { status: 401, body: { detail: 'Authentification requise.' } },
    )
    await expect(api('/search')).rejects.toThrow('Authentification requise.')
    expect(faux).toHaveBeenCalledTimes(3)
  })

  it('ne tente pas de renouveler les routes /auth/', async () => {
    // Un 401 y est une réponse normale — pas une session expirée.
    const faux = enchainer({ status: 401, body: { detail: 'Session absente.' } })
    await expect(api('/auth/me')).rejects.toThrow('Session absente.')
    expect(faux).toHaveBeenCalledTimes(1)
  })
})
