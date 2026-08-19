import { describe, expect, it } from 'vitest'
import { chercher, MAX_RESULTATS, normaliser } from '@/utils/sommaire'
import { construireIndex } from './sommaire'
import { GROUP_IDS, PANEL_IDS } from './sections'

const INDEX = construireIndex()

/** Libellés des résultats, dans l'ordre de pertinence. */
function libelles(saisie: string) {
  return chercher(INDEX, saisie).entrees.map((e) => e.libelle)
}

describe('index du sommaire', () => {
  it('couvre tous les groupes et tous les panneaux', () => {
    const ids = new Set(INDEX.map((e) => e.id))
    for (const id of [...GROUP_IDS, ...PANEL_IDS]) {
      expect(ids.has(id), id).toBe(true)
    }
  })

  it('indexe les réglages eux-mêmes, pas seulement leurs panneaux', () => {
    // Les libellés viennent des tableaux des panneaux (champs.ts) : cette
    // entrée n'existe que parce que l'index les lit vraiment.
    const alertes = INDEX.find((e) => e.id === 'ui-alerts_enabled')
    expect(alertes).toBeDefined()
    expect(alertes?.libelle).toBe('Alertes sur les recherches enregistrées')
    expect(alertes?.chemin).toBe('Interface et engagement › Interface')
    expect(alertes?.panneau).toBe('ui-config-panel')
  })
})

describe('recherche dans le sommaire', () => {
  // Le cas d'usage d'origine : on tape ce dont on se souvient, on tombe
  // sur la case elle-même — pas sur le panneau qui la contient.
  it('mène de « alerte » à la case « Alertes sur les recherches enregistrées »', () => {
    const { entrees } = chercher(INDEX, 'alerte')
    expect(entrees[0].libelle).toBe('Alertes sur les recherches enregistrées')
    expect(entrees[0].id).toBe('ui-alerts_enabled')
  })

  it('ignore la casse et les accents', () => {
    expect(libelles('ALERTES')).toEqual(libelles('alertes'))
    expect(libelles('thesaurus')[0]).toBe('Thésaurus')
    expect(libelles('épinglés')[0]).toBe('Résultats épinglés')
  })

  // Les libellés sont pleins de guillemets français et d'apostrophes
  // typographiques, qu'on ne tape pas.
  it('traverse la ponctuation des libellés', () => {
    expect(libelles('pied de page')).toContain('Pied de page des pages « recherche »')
    expect(libelles("droits d'acces")).toContain(
      'Section « Droits d’accès » de la fiche détail, visible de tous (sinon : administrateurs seuls)',
    )
  })

  it('restreint quand on ajoute un mot', () => {
    const large = chercher(INDEX, 'source').total
    const etroit = chercher(INDEX, 'source web').total
    expect(etroit).toBeGreaterThan(0)
    expect(etroit).toBeLessThan(large)
  })

  it('trouve par mot-clé ce qui n’est pas dans le libellé', () => {
    // « réindexer » ne figure dans aucun libellé : seul le champ
    // motsCles de l'action « Lancer un scan » le porte.
    expect(libelles('reindexer')).toEqual(['Lancer un scan'])
  })

  it('classe le titre exact avant ce qui le contient', () => {
    const resultats = libelles('interface')
    expect(resultats[0]).toBe('Interface')
    expect(resultats).toContain('Interface et engagement')
    expect(resultats.indexOf('Interface')).toBeLessThan(resultats.indexOf('Interface et engagement'))
  })

  it('ne rend rien pour une saisie vide ou sans correspondance', () => {
    expect(chercher(INDEX, '')).toEqual({ entrees: [], total: 0 })
    expect(chercher(INDEX, '   ')).toEqual({ entrees: [], total: 0 })
    expect(chercher(INDEX, 'zzzz').entrees).toEqual([])
  })

  // Une liste tronquée en silence se lit comme une liste complète : le
  // total doit rester au-dessus du nombre affiché pour que le composant
  // puisse le dire.
  it('plafonne la liste mais annonce le total', () => {
    const { entrees, total } = chercher(INDEX, 'e')
    expect(entrees.length).toBe(MAX_RESULTATS)
    expect(total).toBeGreaterThan(MAX_RESULTATS)
  })
})

describe('normaliser', () => {
  it('réduit accents, casse et ponctuation à des mots', () => {
    expect(normaliser('Droits d’accès (ACL)')).toBe('droits d acces acl')
    expect(normaliser('  Thème — Recherche  ')).toBe('theme recherche')
  })
})
