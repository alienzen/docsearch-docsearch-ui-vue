import { beforeEach, describe, expect, it } from 'vitest'
import {
  depuisParametres,
  ecrireUrl,
  lienPermanent,
  versParametres,
  type CriteresPermalien,
} from './permalien'

// Le test qui compte ici est l'aller-retour : critères → URL → critères.
// Un permalien qui perd une facette au passage produit chez le
// destinataire une recherche voisine mais différente de celle qu'on
// croyait partager — et rien à l'écran ne le signale.

const VIDE: CriteresPermalien = {
  query: '',
  ext: [],
  author: [],
  keywords: [],
  folder: [],
  source: [],
  custom: {},
  dateFrom: null,
  dateTo: null,
  sort: '_score',
  page: 1,
  exact: false,
}

function criteres(partiel: Partial<CriteresPermalien>): CriteresPermalien {
  return { ...VIDE, ...partiel }
}

describe('aller-retour', () => {
  it('restitue à l’identique des critères complets', () => {
    const attendus = criteres({
      query: 'budget 2025',
      ext: ['.pdf', '.docx'],
      author: ['Jean Dupont'],
      keywords: ['marché', 'travaux'],
      folder: ['Finance/2025'],
      source: ['documents', 'archives'],
      custom: { bureau: ['Paris', 'Lyon'], fonction: ['Chef de service'] },
      dateFrom: '2025-01-01',
      dateTo: '2025-12-31',
      sort: 'date_modified',
      page: 3,
      exact: false,
    })

    expect(depuisParametres(versParametres(attendus))).toEqual(attendus)
  })

  it('accepte la chaîne avec son point d’interrogation', () => {
    expect(depuisParametres('?q=budget')).toEqual(criteres({ query: 'budget' }))
  })

  // Ce sont ces valeurs-là qui rendent une URL de recherche simple
  // illisible si on les sérialise malgré tout.
  it('omet les valeurs par défaut', () => {
    expect(versParametres(criteres({ query: 'budget' }))).toBe('q=budget')
  })

  // Deux fois la même recherche doit donner deux fois la même URL, quel
  // que soit l'ordre dans lequel l'utilisateur a coché ses facettes.
  it('produit une chaîne stable quel que soit l’ordre des facettes personnalisées', () => {
    const a = versParametres(criteres({ query: 'x', custom: { bureau: ['Paris'], agence: ['Nord'] } }))
    const b = versParametres(criteres({ query: 'x', custom: { agence: ['Nord'], bureau: ['Paris'] } }))
    expect(a).toBe(b)
  })

  // Le mode exact change les résultats : deux liens qui n'en diffèrent
  // que par lui ne ramènent pas les mêmes documents. Le perdre en route
  // ferait donc voir au destinataire une recherche voisine mais
  // différente de celle qu'on croyait lui envoyer — exactement le
  // scénario que ce fichier surveille.
  it('transporte le mode exact', () => {
    const exacte = criteres({ query: 'congres', exact: true })
    expect(versParametres(exacte)).toBe('q=congres&exact=1')
    expect(depuisParametres(versParametres(exacte))).toEqual(exacte)
  })
})

describe('URL sans recherche', () => {
  // « Aucun critère » et « critères vides » ne se confondent pas : sur la
  // première, l'écran doit rester dans son état initial plutôt que de
  // lancer une recherche qui ne cherche rien.
  it('renvoie null quand rien ne décrit une recherche', () => {
    expect(depuisParametres('')).toBeNull()
    expect(depuisParametres('?')).toBeNull()
    expect(depuisParametres('?inconnu=1')).toBeNull()
  })

  it('ne prend pas un tri ou une page pour une recherche', () => {
    expect(depuisParametres('?tri=filename&page=4')).toBeNull()
  })

  // Le mode exact dit COMMENT chercher, pas QUOI : seul, il ne décrit
  // aucune recherche et ne doit donc pas en lancer une vide au
  // chargement de la page.
  it('ne prend pas le mode exact seul pour une recherche', () => {
    expect(depuisParametres('?exact=1')).toBeNull()
  })
})

describe('robustesse', () => {
  // Une URL est une entrée utilisateur : elle se bricole, se tronque au
  // copier-coller et dort dans un signet pendant un an.
  it('ignore une date mal formée sans perdre le reste', () => {
    const lus = depuisParametres('?q=budget&du=hier&au=2025-12-31')
    expect(lus).toEqual(criteres({ query: 'budget', dateFrom: null, dateTo: '2025-12-31' }))
  })

  it('retombe sur la pertinence pour un tri inconnu', () => {
    expect(depuisParametres('?q=x&tri=rm-rf')?.sort).toBe('_score')
  })

  // Dans le doute, la recherche ORDINAIRE : une valeur qu'on ne comprend
  // pas ne doit pas restreindre silencieusement les résultats d'un lien
  // partagé — le destinataire n'aurait aucun moyen de s'en apercevoir.
  it('n’active le mode exact que sur la valeur attendue', () => {
    expect(depuisParametres('?q=x&exact=1')?.exact).toBe(true)
    expect(depuisParametres('?q=x&exact=0')?.exact).toBe(false)
    expect(depuisParametres('?q=x&exact=oui')?.exact).toBe(false)
    expect(depuisParametres('?q=x&exact=')?.exact).toBe(false)
  })

  it('ramène une page absurde à la première', () => {
    expect(depuisParametres('?q=x&page=0')?.page).toBe(1)
    expect(depuisParametres('?q=x&page=-3')?.page).toBe(1)
    expect(depuisParametres('?q=x&page=beaucoup')?.page).toBe(1)
    expect(depuisParametres('?q=x&page=999999')?.page).toBe(1000)
  })

  it('déduplique les valeurs répétées', () => {
    expect(depuisParametres('?type=.pdf&type=.pdf&type=.docx')?.ext).toEqual(['.pdf', '.docx'])
  })

  it('plafonne le nombre de valeurs d’une même facette', () => {
    const trop = Array.from({ length: 80 }, (_, i) => `auteur=A${i}`).join('&')
    expect(depuisParametres('?q=x&' + trop)?.author).toHaveLength(50)
  })

  // Le nom du champ vient de la configuration d'une source SQL, pas d'une
  // liste fermée : il est repris tel quel dans l'URL, donc contrôlé.
  it('écarte un nom de facette personnalisée hors format', () => {
    expect(depuisParametres('?q=x&f.bureau=Paris&f.<script>=1')?.custom).toEqual({
      bureau: ['Paris'],
    })
  })

  it('n’émet pas une facette personnalisée au nom invalide', () => {
    expect(versParametres(criteres({ query: 'x', custom: { 'a b': ['1'] } }))).toBe('q=x')
  })

  it('ignore les valeurs vides', () => {
    expect(depuisParametres('?q=x&auteur=&auteur=%20')?.author).toEqual([])
  })
})

describe('écriture de l’URL', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it('empile une entrée d’historique en mode empiler', () => {
    const avant = window.history.length
    ecrireUrl(criteres({ query: 'budget' }), 'empiler')
    expect(window.location.search).toBe('?q=budget')
    expect(window.history.length).toBe(avant + 1)
  })

  it('remplace l’entrée courante en mode remplacer', () => {
    const avant = window.history.length
    ecrireUrl(criteres({ query: 'budget' }), 'remplacer')
    expect(window.location.search).toBe('?q=budget')
    expect(window.history.length).toBe(avant)
  })

  // Le retour arrière a déjà changé l'URL : la réécrire empilerait une
  // entrée par retour en arrière, et le bouton Précédent ne sortirait
  // plus jamais de la page.
  it('ne touche à rien en mode aucun', () => {
    ecrireUrl(criteres({ query: 'budget' }), 'remplacer')
    ecrireUrl(criteres({ query: 'autre chose' }), 'aucun')
    expect(window.location.search).toBe('?q=budget')
  })

  it('efface la chaîne de requête quand il n’y a plus de critères', () => {
    ecrireUrl(criteres({ query: 'budget' }), 'remplacer')
    ecrireUrl(VIDE, 'remplacer')
    expect(window.location.search).toBe('')
  })

  it('produit un lien absolu à partager', () => {
    expect(lienPermanent(criteres({ query: 'budget' }))).toBe(
      window.location.origin + '/?q=budget',
    )
  })
})
