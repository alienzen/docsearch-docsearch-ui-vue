import { describe, expect, it } from 'vitest'
import { chercher } from '@/utils/sommaire'
import { construireIndex } from './sommaire'
import { PANEL_IDS, SECTIONS } from './sections'

const INDEX = construireIndex()

/** Libellés des résultats, dans l'ordre de pertinence. */
function libelles(saisie: string) {
  return chercher(INDEX, saisie).entrees.map((e) => e.libelle)
}

describe('index du sommaire des statistiques', () => {
  it('couvre tous les panneaux', () => {
    const ids = new Set(INDEX.map((e) => e.id))
    for (const id of PANEL_IDS) {
      expect(ids.has(id), id).toBe(true)
    }
  })

  // L'arbre est plat : chaque section EST un panneau, et sert donc de
  // repli aux ancres qui n'existent pas encore.
  it('fait de chaque section un panneau, sans niveau au-dessus', () => {
    for (const section of SECTIONS) {
      const entree = INDEX.find((e) => e.id === section.id)
      expect(entree?.nature, section.id).toBe('panneau')
      expect(entree?.panneau, section.id).toBe(section.id)
      expect(entree?.chemin, section.id).toBe('')
    }
  })

  /**
   * Une action dont le `panneau` ne serait pas déclaré n'aurait pas de
   * repli utilisable : son ancre manquante — un tableau pas encore
   * chargé — rendrait l'entrée inerte.
   */
  it('rattache chaque action à un panneau déclaré, et l’affiche sous son titre', () => {
    const titres = new Map(SECTIONS.map((s) => [s.id, s.titre]))
    for (const entree of INDEX.filter((e) => e.nature === 'action')) {
      expect(entree.panneau && titres.has(entree.panneau), entree.id).toBe(true)
      expect(entree.chemin, entree.id).toBe(titres.get(entree.panneau!))
    }
  })
})

describe('recherche dans le sommaire des statistiques', () => {
  it('mène de « export » au lien d’export du journal', () => {
    const { entrees } = chercher(INDEX, 'export')
    expect(entrees[0].id).toBe('logs-export')
    expect(entrees[0].chemin).toBe('Historique des recherches')
  })

  it('trouve par mot-clé ce qui n’est pas dans le libellé', () => {
    // « tableur » ne figure dans aucun libellé : seul le champ motsCles
    // de l'export le porte.
    expect(libelles('tableur')).toEqual(['Exporter en XLS'])
  })

  it('ignore la casse et les accents', () => {
    expect(libelles('DETRACTEURS')).toEqual(libelles('détracteurs'))
    expect(libelles('resultat')[0]).toBe('Recherches sans résultat')
  })

  // Trois panneaux ont un tableau « par groupe » : c'est le cas où le
  // chemin affiché sous le libellé fait tout le travail de distinction.
  it('distingue les tableaux « par groupe » par leur panneau', () => {
    const parGroupe = chercher(INDEX, 'par groupe').entrees
    expect(parGroupe.map((e) => e.chemin)).toContain('Suggestions')
    expect(parGroupe.map((e) => e.chemin)).toContain("Vue d'ensemble")
    expect(new Set(parGroupe.map((e) => e.id)).size).toBe(parGroupe.length)
  })

  it('ne rend rien pour une saisie vide ou sans correspondance', () => {
    expect(chercher(INDEX, '')).toEqual({ entrees: [], total: 0 })
    expect(chercher(INDEX, 'zzzz').entrees).toEqual([])
  })
})
