import { describe, expect, it } from 'vitest'
import {
  buildSearchCriteria,
  hasActiveCriteria,
  parseAdvancedQuery,
} from './search'

// Le parseur de syntaxe avancée est la pièce la plus subtile du front :
// il décide silencieusement de ce qui devient un filtre et de ce qui
// reste du texte libre. Ces cas sont ceux dont le comportement devait
// être préservé à l'identique lors du portage depuis
// docsearch-ui/public/js/search.js.

// Facettes SQL personnalisées telles que les expose /custom-facets :
// {opérateur en minuscules: champ ES}.
const CUSTOM = { bureau: 'bureau', num_tel: 'num_tel' }

describe('parseAdvancedQuery', () => {
  it('laisse intact un texte sans opérateur', () => {
    const { remaining, extracted } = parseAdvancedQuery('rapport annuel 2024')
    expect(remaining).toBe('rapport annuel 2024')
    expect(extracted.author).toEqual([])
    expect(extracted.custom).toEqual({})
  })

  it('extrait un opérateur simple et le retire du texte libre', () => {
    const { remaining, extracted } = parseAdvancedQuery('type:pdf rapport')
    expect(remaining).toBe('rapport')
    expect(extracted.ext).toEqual(['.pdf'])
  })

  it('préfixe et normalise les extensions', () => {
    // "type:PDF" comme "type:.pdf" doivent produire la valeur brute du
    // champ ES, telle que la renvoie la facette extensions.
    expect(parseAdvancedQuery('type:PDF').extracted.ext).toEqual(['.pdf'])
    expect(parseAdvancedQuery('type:.PDF').extracted.ext).toEqual(['.pdf'])
  })

  it('accepte une valeur entre guillemets contenant des espaces', () => {
    const { remaining, extracted } = parseAdvancedQuery('auteur:"Jean Dupont" bilan')
    expect(extracted.author).toEqual(['Jean Dupont'])
    expect(remaining).toBe('bilan')
  })

  it('accepte les alias anglais', () => {
    expect(parseAdvancedQuery('folder:Finance').extracted.folder).toEqual(['Finance'])
    expect(parseAdvancedQuery('keyword:urgent').extracted.keywords).toEqual(['urgent'])
  })

  it('cumule plusieurs occurrences du même opérateur', () => {
    const { extracted } = parseAdvancedQuery('type:pdf type:docx')
    expect(extracted.ext).toEqual(['.pdf', '.docx'])
  })

  it('combine plusieurs opérateurs et du texte libre', () => {
    const { remaining, extracted } = parseAdvancedQuery(
      'type:pdf auteur:"Jean Dupont" rapport annuel',
    )
    expect(extracted.ext).toEqual(['.pdf'])
    expect(extracted.author).toEqual(['Jean Dupont'])
    expect(remaining).toBe('rapport annuel')
  })

  it('laisse tel quel un opérateur inconnu, plutôt que de le supprimer', () => {
    // Sinon une URL ou un "ratio 3:1" collé dans la barre disparaîtrait
    // silencieusement de la recherche.
    const { remaining, extracted } = parseAdvancedQuery('foo:bar rapport')
    expect(remaining).toBe('foo:bar rapport')
    expect(extracted.custom).toEqual({})
  })

  it('reconnaît une facette SQL personnalisée', () => {
    const { remaining, extracted } = parseAdvancedQuery('bureau:Paris agents', CUSTOM)
    expect(extracted.custom).toEqual({ bureau: ['Paris'] })
    expect(remaining).toBe('agents')
  })

  it('accepte un underscore dans le nom de facette personnalisée', () => {
    const { extracted } = parseAdvancedQuery('num_tel:0102030405', CUSTOM)
    expect(extracted.custom).toEqual({ num_tel: ['0102030405'] })
  })

  it('donne la priorité aux opérateurs fixes sur les facettes personnalisées', () => {
    // Une source SQL qui déclarerait un champ "source" ne doit pas
    // pouvoir masquer la dimension source commune à l'installation.
    const { extracted } = parseAdvancedQuery('source:agents', { source: 'source_sql' })
    expect(extracted.source).toEqual(['agents'])
    expect(extracted.custom).toEqual({})
  })

  it('ignore un opérateur sans valeur', () => {
    const { remaining, extracted } = parseAdvancedQuery('auteur: rapport')
    expect(extracted.author).toEqual([])
    expect(remaining).toBe('auteur: rapport')
  })

  it('accepte une valeur entre guillemets vide sans la retenir', () => {
    const { extracted } = parseAdvancedQuery('auteur:""')
    expect(extracted.author).toEqual([])
  })

  it('normalise les espaces laissés par les opérateurs retirés', () => {
    const { remaining } = parseAdvancedQuery('rapport type:pdf   annuel')
    expect(remaining).toBe('rapport annuel')
  })

  it("n'extrait rien d'une recherche exacte entre guillemets", () => {
    // La phrase exacte est transmise telle quelle à l'API, qui la
    // reconnaît à ses guillemets englobants pour désactiver le flou.
    const { remaining, extracted } = parseAdvancedQuery('"budget 2024"')
    expect(remaining).toBe('"budget 2024"')
    expect(extracted.keywords).toEqual([])
  })
})

describe('buildSearchCriteria', () => {
  const filters = {
    sort: '_score',
    ext: [] as string[],
    author: [] as string[],
    keywords: [] as string[],
    folder: [] as string[],
    source: [] as string[],
    custom: {} as Record<string, string[]>,
    dateFrom: null,
    dateTo: null,
  }

  it('envoie extension à null quand aucune extension n’est filtrée', () => {
    // Seule dimension à null plutôt que [] — comportement d'origine,
    // que l'API distingue.
    expect(buildSearchCriteria('rapport', filters).extension).toBeNull()
    expect(buildSearchCriteria('rapport', filters).author).toEqual([])
  })

  it('transmet les extensions sélectionnées', () => {
    expect(buildSearchCriteria('', { ...filters, ext: ['.pdf'] }).extension).toEqual(['.pdf'])
  })

  it("n'ajoute search_in que s'il est précisé", () => {
    expect('search_in' in buildSearchCriteria('a', filters)).toBe(false)
    expect(buildSearchCriteria('a', { ...filters, searchIn: 'title' }).search_in).toBe('title')
  })
})

describe('hasActiveCriteria', () => {
  const empty = buildSearchCriteria('', {
    sort: '_score',
    ext: [],
    author: [],
    keywords: [],
    folder: [],
    source: [],
    custom: {},
    dateFrom: null,
    dateTo: null,
  })

  it('est faux quand tout est vide', () => {
    expect(hasActiveCriteria(empty)).toBe(false)
  })

  it('est vrai avec du texte libre seul', () => {
    expect(hasActiveCriteria({ ...empty, query: 'rapport' })).toBe(true)
  })

  it('est vrai avec un filtre seul, sans texte libre', () => {
    expect(hasActiveCriteria({ ...empty, extension: ['.pdf'] })).toBe(true)
    expect(hasActiveCriteria({ ...empty, date_from: '2024-01-01' })).toBe(true)
    expect(hasActiveCriteria({ ...empty, custom: { bureau: ['Paris'] } })).toBe(true)
  })

  it('est faux quand une facette personnalisée est présente mais vide', () => {
    expect(hasActiveCriteria({ ...empty, custom: { bureau: [] } })).toBe(false)
  })
})
