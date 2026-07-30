import { describe, expect, it } from 'vitest'
import { extraFields } from './extraFields'

/** Un agent tel que le renvoie réellement /search sur une source SQL. */
const agent = {
  id: '12',
  score: 1,
  highlight: [],
  title: 'Roger Petit',
  source: 'agents',
  indexed_at: '2026-07-30T12:39:05Z',
  'acl.public': true,
  nom: 'Petit',
  prenom: 'Roger',
  mail: 'petit.roger@direction.com',
  bureau: 'Reims',
  fonction: 'Assistant administratif',
  numero_piece: '505',
  adresse: '9 Rue de Vesle, 51100 Reims',
  telephone: '05 84 14 38 63',
}

const LIBELLES = { bureau: 'Bureau', fonction: 'Fonction', telephone: 'Téléphone' }

describe('champs apportés par la source', () => {
  it('retient les colonnes de la source et écarte le schéma commun', () => {
    const cles = extraFields(agent, LIBELLES).map((c) => c.key)
    expect(cles).toContain('telephone')
    expect(cles).toContain('bureau')
    expect(cles).toContain('fonction')
    expect(cles).toContain('mail')
    expect(cles).toContain('adresse')
    // Déjà rendus ailleurs dans la carte, ou purement techniques.
    for (const exclu of ['id', 'score', 'highlight', 'title', 'source', 'indexed_at', 'acl.public'])
      expect(cles).not.toContain(exclu)
  })

  it('préfère le libellé de la source, sinon dérive du nom du champ', () => {
    const champs = Object.fromEntries(extraFields(agent, LIBELLES).map((c) => [c.key, c.label]))
    expect(champs.telephone).toBe('Téléphone')
    expect(champs.numero_piece).toBe('Numero piece')
  })

  // Les colonnes que la source a désignées comme structurantes passent
  // devant : c'est l'information qu'on cherche d'abord sur un agent.
  it('place les colonnes « facette » en tête', () => {
    const cles = extraFields(agent, LIBELLES).map((c) => c.key)
    const dernierLibelle = Math.max(...['bureau', 'fonction', 'telephone'].map((k) => cles.indexOf(k)))
    const premierAutre = Math.min(...['mail', 'adresse'].map((k) => cles.indexOf(k)))
    expect(dernierLibelle).toBeLessThan(premierAutre)
  })

  // Le libellé vide est le moyen donné à l'administrateur d'écarter une
  // colonne sans intérêt à l'écran (identifiant interne, nom déjà dans le
  // titre) — à distinguer d'un champ simplement absent de la table.
  it('masque un champ dont le libellé est vide', () => {
    const cles = extraFields(agent, { ...LIBELLES, nom: '', prenom: '', numero_piece: '' }).map(
      (c) => c.key,
    )
    expect(cles).not.toContain('nom')
    expect(cles).not.toContain('numero_piece')
    expect(cles).toContain('mail')
  })

  it('accepte un libellé explicite accentué', () => {
    const champs = Object.fromEntries(
      extraFields(agent, { numero_piece: 'Numéro de pièce' }).map((c) => [c.key, c.label]),
    )
    expect(champs.numero_piece).toBe('Numéro de pièce')
  })

  // null = « pas de libellé saisi », qui doit rester affiché sous son
  // libellé dérivé — sans quoi une colonne non configurée disparaîtrait.
  it('affiche un champ dont le libellé vaut null', () => {
    const champs = Object.fromEntries(
      extraFields(agent, { mail: null }).map((c) => [c.key, c.label]),
    )
    expect(champs.mail).toBe('Mail')
  })

  it('ignore les valeurs vides et non affichables sur une ligne', () => {
    const cles = extraFields(
      { id: '1', score: 1, highlight: [], vide: '', absent: null, liste: [1, 2] },
      {},
    ).map((c) => c.key)
    expect(cles).toEqual([])
  })

  // Un document bureautique n'apporte aucune colonne : sa carte ne doit
  // pas gagner de ligne au passage.
  it('ne renvoie rien pour un document de source fichier', () => {
    const doc = {
      id: 'abc',
      score: 3,
      highlight: [],
      filename: 'rapport.pdf',
      extension: '.pdf',
      author: 'Dupont',
      folder: '/docs',
      filepath: '/docs/rapport.pdf',
      date_modified: '2025-01-01',
      size: 1024,
      keywords: ['budget'],
      source: 'documents',
      // Champ de service de l'ingestion, qui remontait dans la carte.
      folder_top: 'docs',
    }
    expect(extraFields(doc, {})).toEqual([])
  })
})
