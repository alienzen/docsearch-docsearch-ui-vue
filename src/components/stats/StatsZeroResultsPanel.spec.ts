import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { VIcon } from '@gouvminint/vue-dsfr'
import StatsZeroResultsPanel from './StatsZeroResultsPanel.vue'

// Ce que ces tests protègent n'est pas l'affichage d'un tableau, c'est
// une DISTINCTION : « rien trouvé parce que le contenu manque » et
// « rien trouvé parce que le filtre était trop serré » sont le même
// écran vide pour l'utilisateur, et n'appellent pas la même correction.
// L'étiquette « Sans filtre » est ce qui les sépare — l'oublier rendrait
// la colonne trompeuse plutôt qu'incomplète.
//
// L'agrégation, elle, est testée contre le vrai Elasticsearch côté API
// (test_zero_resultat_criteres.py) ; ici, seule la traduction en
// libellés lisibles est en jeu.

const REPONSE = {
  total_zero_result_searches: 6,
  results: [
    {
      query: 'congés',
      count: 4,
      last_seen: '2026-08-16T10:00:00Z',
      criteres: [
        { champ: 'extension', valeur: '.pdf', count: 2 },
        { champ: 'author', valeur: 'Dupont', count: 1 },
        { champ: 'search_in', valeur: 'title', count: 1 },
        { champ: 'periode', valeur: '', count: 1 },
      ],
      sans_critere: 1,
    },
    {
      query: 'budget',
      count: 2,
      last_seen: '2026-08-15T09:00:00Z',
      criteres: [{ champ: 'source', valeur: 'finance', count: 2 }],
      sans_critere: 0,
    },
  ],
  by_group: [
    { group: 'docsearch-users', count: 4 },
    { group: '__sans_groupe__', count: 2 },
  ],
}

function stubFetch(body: unknown = REPONSE) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(body) }),
  )
}

async function monter() {
  const w = mount(StatsZeroResultsPanel, {
    global: { plugins: [createPinia()], components: { VIcon } },
  })
  await flushPromises()
  return w
}

/** Les étiquettes de critère de la n-ième ligne. */
function criteres(w: Awaited<ReturnType<typeof monter>>, rang: number) {
  const ligne = w.findAll('[data-testid="zero-result-ligne"]')[rang]
  return ligne
    .findAll('[data-testid="zero-result-critere"]')
    .map((n) => n.text().replace(/\s+/g, ' '))
}

describe('StatsZeroResultsPanel — critères', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    stubFetch()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('traduit chaque critère en libellé lisible, avec son compte', async () => {
    const w = await monter()
    expect(criteres(w, 0)).toEqual([
      'Type : PDF (2)',
      'Auteur : Dupont (1)',
      'Recherche dans : Titre (1)',
      // Sans valeur : seule la PRÉSENCE d'une période a été agrégée,
      // ventiler par date choisie aurait produit une ligne par jour.
      'Période (1)',
    ])
  })

  it('affiche « Sans filtre » et son compte', async () => {
    const w = await monter()
    const ligne = w.findAll('[data-testid="zero-result-ligne"]')[0]
    expect(ligne.find('[data-testid="zero-result-sans-critere"]').text()).toContain('Sans filtre')
    expect(ligne.find('[data-testid="zero-result-sans-critere"]').text()).toContain('1')
  })

  // LE cas qui distingue les deux diagnostics : « budget » n'a jamais
  // été lancée sans filtre. Afficher « Sans filtre (0) » laisserait
  // croire l'inverse à la lecture rapide d'une colonne d'étiquettes.
  it('n’affiche pas « Sans filtre » quand aucune occurrence n’était nue', async () => {
    const w = await monter()
    const ligne = w.findAll('[data-testid="zero-result-ligne"]')[1]
    expect(ligne.find('[data-testid="zero-result-sans-critere"]').exists()).toBe(false)
    expect(criteres(w, 1)).toEqual(['Source : finance (2)'])
  })

  it('met un tiret quand une requête n’a aucun critère connu', async () => {
    stubFetch({
      ...REPONSE,
      results: [
        {
          query: 'xyzzy',
          count: 1,
          last_seen: '2026-08-16T10:00:00Z',
          criteres: [],
          sans_critere: 0,
        },
      ],
    })
    const w = await monter()
    expect(criteres(w, 0)).toEqual([])
    expect(w.find('[data-testid="zero-result-ligne"]').text()).toContain('—')
  })

  // L'interface et l'API sont deux conteneurs redémarrés séparément :
  // une interface neuve devant une API pas encore reconstruite reçoit
  // l'ancienne réponse, sans `criteres`. Le tableau doit alors perdre
  // une colonne, pas emporter toute la page de statistiques.
  it('supporte une réponse d’API antérieure aux critères', async () => {
    stubFetch({
      ...REPONSE,
      results: [{ query: 'xyzzy', count: 1, last_seen: '2026-08-16T10:00:00Z' }],
    })
    const w = await monter()
    const ligne = w.find('[data-testid="zero-result-ligne"]')
    expect(ligne.text()).toContain('xyzzy')
    expect(criteres(w, 0)).toEqual([])
  })

  it('avertit que les comptes ne s’additionnent pas', async () => {
    // La note n'est pas décorative : sans elle, la somme des étiquettes
    // se lit comme une ventilation des occurrences, ce qu'elle n'est pas.
    const w = await monter()
    expect(w.text()).toContain("ne s'additionnent pas")
  })
})
