import { describe, expect, it } from 'vitest'
import {
  dimensionsAffichables,
  periodeAffichable,
  seauxAffichables,
  type DimensionFacette,
} from './facettes'
import type { SearchableSource } from '@/stores/uiConfig'

// Les trois types de source tels que /searchable-sources les renvoie.
// `agents` est la source SQL de la pile de dev : ses colonnes sont celles
// d'un annuaire, aucune ne s'appelle `extension`, `folder` ni
// `date_modified`.
const SOURCES: SearchableSource[] = [
  { name: 'documents', label: 'Documents', type: 'file', collectable: true },
  { name: 'intranet', label: 'Intranet', type: 'web', collectable: true },
  {
    name: 'agents',
    label: 'Agents',
    type: 'sql',
    collectable: false,
    card_fields: { nom: null, bureau: 'Bureau', telephone: 'Téléphone', mail: '' },
  },
  {
    name: 'notes',
    label: 'Notes SQL',
    type: 'sql',
    collectable: true,
    // Une source SQL a le droit de mapper les noms du schéma commun.
    card_fields: { objet: null, author: 'Rédacteur', date_modified: 'Rédigée le' },
  },
  // Source portée par un module complémentaire. Le type est "plugin" au
  // singulier quel que soit le module (voir REGISTRES côté API), et
  // aucune de ces sources ne déclare de `card_fields`.
  { name: 'rss_presse', label: 'Presse', type: 'plugin', collectable: true },
]

describe('dimensions de facettes selon les sources sélectionnées', () => {
  it('affiche tout sans sélection de source', () => {
    const d = dimensionsAffichables([], SOURCES)
    expect([...d].sort()).toEqual(['author', 'date', 'ext', 'folder', 'keywords'])
  })

  it('garde les cinq facettes fixes pour une source fichier', () => {
    const d = dimensionsAffichables(['documents'], SOURCES)
    expect([...d].sort()).toEqual(['author', 'date', 'ext', 'folder', 'keywords'])
  })

  it('ne garde que les colonnes déclarées par une source SQL', () => {
    const d = dimensionsAffichables(['agents'], SOURCES)
    // L'annuaire n'a ni extension, ni auteur, ni mots-clés, ni dossier,
    // ni date de modification : plus une seule facette fixe.
    expect([...d]).toEqual([])
  })

  it('reconnaît les colonnes SQL mappées sur le schéma commun', () => {
    const d = dimensionsAffichables(['notes'], SOURCES)
    expect([...d].sort()).toEqual(['author', 'date'])
  })

  it('limite une source web à l’extension et à la date', () => {
    const d = dimensionsAffichables(['intranet'], SOURCES)
    expect([...d].sort()).toEqual(['date', 'ext'])
  })

  it('réunit les dimensions de plusieurs sources sélectionnées', () => {
    const d = dimensionsAffichables(['intranet', 'notes'], SOURCES)
    expect([...d].sort()).toEqual(['author', 'date', 'ext'])
  })

  it('retire extension et dossier à une source de module', () => {
    // Le contrat écrit `extension: ""` sur tout document poussé par un
    // module et lui interdit `folder` : les deux sections seraient vides
    // à coup sûr. La date, elle, ne se devine pas depuis le type — voir
    // periodeAffichable().
    const d = dimensionsAffichables(['rss_presse'], SOURCES)
    expect([...d].sort()).toEqual(['author', 'keywords'])
  })

  it('rend son extension à une source de module dès que la recherche en trouve', () => {
    // Ce n'est pas cette fonction qui le fait, mais `affiche()` dans
    // FacetsSidebar : la dimension absente n'empêche jamais une facette
    // qui a des seaux de s'afficher. Le rappel est ici parce que c'est
    // la seule chose qui rattrape un module posant de vraies extensions.
    expect(seauxAffichables([{ key: '', doc_count: 12 }])).toEqual([])
    expect(seauxAffichables([{ key: 'pdf', doc_count: 4 }])).toHaveLength(1)
  })

  it('affiche tout si une source sélectionnée est inconnue du registre', () => {
    // Registre pas encore chargé, ou source retirée depuis le permalien :
    // à défaut de savoir, on ne masque rien.
    const d = dimensionsAffichables(['agents', 'disparue'], SOURCES)
    expect([...d].sort()).toEqual(['author', 'date', 'ext', 'folder', 'keywords'])
  })

  it('affiche tout pour un type de source inconnu', () => {
    const inconnue: SearchableSource[] = [{ name: 'x', label: 'X', type: 'graphql' }]
    expect([...dimensionsAffichables(['x'], inconnue)].sort()).toEqual([
      'author',
      'date',
      'ext',
      'folder',
      'keywords',
    ])
  })
})

describe('affichage de la période de modification', () => {
  const AUCUNE = new Set<DimensionFacette>()
  const AVEC_DATE = new Set<DimensionFacette>(['date'])

  it('suit la sélection de sources quand elle déclare porter des dates', () => {
    expect(periodeAffichable(AVEC_DATE, 0, false)).toBe(true)
  })

  it('suit les résultats quand la sélection ne déclare rien', () => {
    expect(periodeAffichable(AUCUNE, 3, false)).toBe(true)
    expect(periodeAffichable(AUCUNE, 0, false)).toBe(false)
  })

  it('garde la section tant qu’un intervalle est coché', () => {
    // Sinon le seul endroit d'où décocher disparaît avec les résultats
    // que le critère vient de faire disparaître.
    expect(periodeAffichable(AUCUNE, 0, true)).toBe(true)
  })

  it('ne masque rien face à une API qui ne renvoie pas le compte', () => {
    // Interface plus récente que l'API : à défaut de savoir, on affiche.
    expect(periodeAffichable(AUCUNE, undefined, false)).toBe(true)
  })
})

describe('seaux affichables', () => {
  it('écarte les seaux sans clé qu’Elasticsearch renvoie pour un champ vide', () => {
    const seaux = seauxAffichables([
      { key: '', doc_count: 7 },
      { key: '.pdf', doc_count: 3 },
    ])
    expect(seaux.map((s) => s.key)).toEqual(['.pdf'])
  })
})
