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

  // L'empreinte de contenu est posée par l'ingestion sur tout document
  // fichier : elle ne peut pas se masquer par `card_fields`, qui ne
  // décrit que les colonnes d'une source SQL. Elle sert à
  // l'administrateur (panneau des doublons), à personne d'autre.
  it('réserve l’empreinte de contenu aux administrateurs', () => {
    const doc = { id: 'abc', filename: 'rapport.pdf', content_sha256: 'a1b2c3' }
    expect(extraFields(doc, {}).map((c) => c.key)).not.toContain('content_sha256')
    expect(extraFields(doc, {}, { admin: true }).map((c) => c.key)).toContain('content_sha256')
  })

  // Le défaut protège : la carte de résultat et la fiche détail passent
  // le drapeau, un troisième appelant qui l'oublierait masquerait plutôt
  // que de divulguer.
  it('masque les champs réservés quand le drapeau est absent', () => {
    const champs = extraFields({ id: 'abc', content_sha256: 'a1b2c3' })
    expect(champs).toEqual([])
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

describe('plomberie des modules complémentaires', () => {
  /**
   * Un document poussé par un module porte `run_id`, l'identifiant de la
   * passe qui l'a produit — c'est ce que compare la réconciliation de fin
   * de passe côté cœur. Il ne dit rien du document, et s'affichait en
   * clair sur la carte de résultat : « Run id :
   * 2026-08-17T15:46:47.930402+00:00-b8bb », entre l'auteur et le flux.
   *
   * Constaté à l'écran sur la source RSS le 2026-08-17, mais présent
   * depuis le module d'exemple : tout document de module en portait un.
   */
  const article = {
    id: 'a1',
    source: 'rss_presse',
    title: 'Le budget 2027 en discussion',
    author: 'Camille Rey',
    run_id: '2026-08-17T15:46:47.930402+00:00-b8bb',
    flux: 'Le Monde — Une',
    image: 'https://intranet.exemple.fr/img/une.jpg',
  }

  it('n’affiche pas l’identifiant de passe', () => {
    const cles = extraFields(article, {}).map((c) => c.key)

    expect(cles).not.toContain('run_id')
  })

  it('affiche toujours les champs déclarés par le module', () => {
    // Le témoin : ce n'est pas tout le bloc qui a disparu, seulement la
    // donnée de service. `flux` est déclaré au manifeste du module RSS et
    // porte sa facette.
    const cles = extraFields(article, {}).map((c) => c.key)

    expect(cles).toContain('flux')
  })

  /**
   * L'illustration est rendue AILLEURS, en vignette (DocumentVignette.vue) : ici
   * elle s'affichait aussi en clair, « Image : https://… » au milieu des
   * métadonnées. Et rien ne permettait de la masquer côté administration
   * — `card_fields` ne couvre que les sources SQL, une source de module
   * reçoit toujours une table de libellés vide, d'où l'exclusion en dur.
   */
  it('n’affiche pas l’adresse de l’illustration', () => {
    const cles = extraFields(article, {}).map((c) => c.key)

    expect(cles).not.toContain('image')
  })

  it('l’exclut même d’un administrateur', () => {
    // Ce n'est pas une donnée réservée mais une donnée DÉJÀ RENDUE : la
    // montrer en double à l'administrateur n'aurait aucun sens.
    const cles = extraFields(article, {}, { admin: true }).map((c) => c.key)

    expect(cles).not.toContain('image')
  })
})
