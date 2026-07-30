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
