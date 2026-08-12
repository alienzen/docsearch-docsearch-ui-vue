/**
 * Permaliens de recherche — l'état de la recherche vit dans l'URL.
 *
 * Sans ça (état de l'interface jusqu'ici), une recherche ne s'envoie pas
 * à un collègue, le bouton Précédent quitte les résultats au lieu de
 * revenir à la recherche précédente, et F5 perd tout.
 *
 * ── Ce que l'URL porte : les critères CANONIQUES, pas le texte tapé ───
 *
 * C'est la décision structurante. La barre de recherche accepte des
 * opérateurs (`auteur:Dupont`, `type:pdf` — voir parseAdvancedQuery dans
 * api/search.ts) que `doSearch()` extrait aussitôt en filtres : après une
 * recherche, l'opérateur tapé et la même valeur cochée dans une facette
 * sont exactement le même état. Sérialiser le texte brut ferait diverger
 * ces deux chemins et rendrait le permalien dépendant de la façon dont
 * l'utilisateur s'y est pris. On sérialise donc l'état APRÈS extraction,
 * et la barre de recherche est reconstruite à partir de lui.
 *
 * Conséquence utile : une URL écrite à la main (`?q=type:pdf`) reste
 * comprise — la recherche l'analyse, puis réécrit l'URL sous sa forme
 * canonique (`?type=.pdf`).
 *
 * ── Ce que l'URL ne porte PAS ────────────────────────────────────────
 *
 * Aucun droit. Le destinataire d'un lien refait la recherche avec SES
 * ACL et verra peut-être moins de résultats (voir build_acl_filter côté
 * API) — c'est le comportement voulu, et il est annoncé à l'utilisateur
 * au moment de copier le lien.
 *
 * Ni les préférences d'affichage (vue compacte, facettes repliées) :
 * elles appartiennent au poste, pas à la recherche, et vivent dans
 * usePreferencesStore.
 *
 * ── Noms des paramètres ──────────────────────────────────────────────
 *
 * En français, comme le `suite` de la page de connexion : ces URL sont
 * lues et recopiées par des utilisateurs.
 */

import { SORT_OPTIONS } from '@/constants'

export type CriteresPermalien = {
  query: string
  ext: string[]
  author: string[]
  keywords: string[]
  folder: string[]
  source: string[]
  custom: Record<string, string[]>
  dateFrom: string | null
  dateTo: string | null
  sort: string
  page: number
}

/**
 * Comment l'écriture de l'URL se comporte vis-à-vis de l'historique :
 *
 * - `empiler`   : nouvelle entrée (soumission d'une recherche, changement
 *                 de page, restauration d'une recherche enregistrée) —
 *                 c'est ce qui donne un sens au bouton Précédent ;
 * - `remplacer` : on affine (facette, tri, période). Empiler chaque
 *                 basculement de facette obligerait à cliquer quinze fois
 *                 sur Précédent pour sortir d'une recherche ;
 * - `aucun`     : ne touche pas à l'historique. Sert au retour arrière
 *                 lui-même : le navigateur a DÉJÀ changé l'URL, la
 *                 réécrire créerait une boucle.
 */
export type ModeHistorique = 'empiler' | 'remplacer' | 'aucun'

/** Dimensions à valeurs multiples : ref du store → paramètre d'URL. */
const PARAMETRES = {
  ext: 'type',
  author: 'auteur',
  keywords: 'mots-cles',
  folder: 'dossier',
  source: 'source',
} as const

type DimensionMultiple = keyof typeof PARAMETRES

/**
 * Préfixe des facettes personnalisées d'une source SQL (`f.bureau=Paris`).
 * Un préfixe est nécessaire : leurs noms de champ viennent de la
 * configuration de la source et pourraient entrer en collision avec les
 * paramètres fixes ci-dessus.
 */
const PREFIXE_CUSTOM = 'f.'

/** Les seuls tris que le sélecteur propose — voir SORT_OPTIONS. */
const TRIS_CONNUS = new Set(SORT_OPTIONS.map((o) => o.value))

const TRI_DEFAUT = '_score'

/**
 * Garde-fous de lecture. Une URL est une entrée utilisateur comme une
 * autre : elle se bricole à la main, se tronque au copier-coller et
 * traîne dans un signet pendant un an.
 */
const MAX_VALEURS = 50
const MAX_PAGE = 1000
const CHAMP_CUSTOM = /^[A-Za-z0-9_-]{1,64}$/
const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/

function listeSaine(values: string[]): string[] {
  const vues = new Set<string>()
  for (const v of values) {
    const valeur = v.trim()
    if (valeur && !vues.has(valeur)) vues.add(valeur)
    if (vues.size >= MAX_VALEURS) break
  }
  return [...vues]
}

function dateSaine(value: string | null): string | null {
  return value && DATE_ISO.test(value) ? value : null
}

/**
 * Critères → chaîne de requête (sans le `?`), dans un ordre FIXE.
 *
 * L'ordre compte : deux recherches identiques doivent produire deux URL
 * identiques, sans quoi le même lien copié deux fois diffère et
 * l'historique du navigateur se remplit de doublons apparents. D'où
 * aussi le tri des noms de facettes personnalisées, dont l'ordre
 * d'insertion dans l'objet dépend des clics de l'utilisateur.
 */
export function versParametres(criteres: CriteresPermalien): string {
  const params = new URLSearchParams()

  if (criteres.query.trim()) params.set('q', criteres.query.trim())

  for (const [dimension, nom] of Object.entries(PARAMETRES) as [DimensionMultiple, string][]) {
    for (const valeur of listeSaine(criteres[dimension] || [])) params.append(nom, valeur)
  }

  for (const champ of Object.keys(criteres.custom || {}).sort()) {
    if (!CHAMP_CUSTOM.test(champ)) continue
    for (const valeur of listeSaine(criteres.custom[champ] || [])) {
      params.append(PREFIXE_CUSTOM + champ, valeur)
    }
  }

  if (dateSaine(criteres.dateFrom)) params.set('du', criteres.dateFrom as string)
  if (dateSaine(criteres.dateTo)) params.set('au', criteres.dateTo as string)

  // Valeurs par défaut omises : une URL de recherche simple reste lisible
  // (`?q=budget` plutôt que `?q=budget&tri=_score&page=1`).
  if (criteres.sort && criteres.sort !== TRI_DEFAUT) params.set('tri', criteres.sort)
  if (criteres.page > 1) params.set('page', String(criteres.page))

  return params.toString()
}

/**
 * Chaîne de requête → critères, ou `null` si l'URL n'en porte aucun.
 *
 * `null` et « critères vides » sont deux choses différentes : le premier
 * signifie « cette URL ne décrit pas de recherche », et l'appelant doit
 * alors laisser l'écran dans son état initial plutôt que de lancer une
 * recherche vide.
 *
 * Tout paramètre inconnu, mal formé ou hors bornes est IGNORÉ, jamais
 * une erreur : un permalien un peu abîmé doit encore ouvrir la meilleure
 * recherche qu'on puisse en tirer.
 */
export function depuisParametres(chaine: string): CriteresPermalien | null {
  const params = new URLSearchParams(chaine.startsWith('?') ? chaine.slice(1) : chaine)

  const custom: Record<string, string[]> = {}
  for (const cle of new Set(params.keys())) {
    if (!cle.startsWith(PREFIXE_CUSTOM)) continue
    const champ = cle.slice(PREFIXE_CUSTOM.length)
    if (!CHAMP_CUSTOM.test(champ)) continue
    const valeurs = listeSaine(params.getAll(cle))
    if (valeurs.length) custom[champ] = valeurs
  }

  const tri = params.get('tri')
  const page = Number.parseInt(params.get('page') || '', 10)

  const criteres: CriteresPermalien = {
    query: (params.get('q') || '').trim(),
    ext: listeSaine(params.getAll(PARAMETRES.ext)),
    author: listeSaine(params.getAll(PARAMETRES.author)),
    keywords: listeSaine(params.getAll(PARAMETRES.keywords)),
    folder: listeSaine(params.getAll(PARAMETRES.folder)),
    source: listeSaine(params.getAll(PARAMETRES.source)),
    custom,
    dateFrom: dateSaine(params.get('du')),
    dateTo: dateSaine(params.get('au')),
    // Un tri inconnu part tel quel vers Elasticsearch, qui refuse de
    // trier sur un champ qu'il n'a pas : on retombe sur la pertinence.
    sort: tri && TRIS_CONNUS.has(tri) ? tri : TRI_DEFAUT,
    page: Number.isFinite(page) && page > 1 ? Math.min(page, MAX_PAGE) : 1,
  }

  return porteUneRecherche(criteres) ? criteres : null
}

/**
 * Vrai si ces critères décrivent quelque chose à chercher. Volontairement
 * aligné sur hasActiveCriteria() (api/search.ts) : le tri et la page
 * n'en font pas partie, `?tri=filename` seul ne décrit aucune recherche.
 */
function porteUneRecherche(c: CriteresPermalien): boolean {
  return !!(
    c.query ||
    c.ext.length ||
    c.author.length ||
    c.keywords.length ||
    c.folder.length ||
    c.source.length ||
    c.dateFrom ||
    c.dateTo ||
    Object.values(c.custom).some((valeurs) => valeurs.length)
  )
}

/** URL absolue à copier — c'est ce qu'on partage, pas la seule requête. */
export function lienPermanent(criteres: CriteresPermalien): string {
  const params = versParametres(criteres)
  const { origin, pathname } = window.location
  return origin + pathname + (params ? '?' + params : '')
}

/**
 * Écrit l'URL courante. Volontairement le SEUL endroit du code qui
 * touche à `history` : le store appelle celui-ci, jamais l'inverse.
 */
export function ecrireUrl(criteres: CriteresPermalien, mode: ModeHistorique): void {
  if (mode === 'aucun') return
  const params = versParametres(criteres)
  const url = window.location.pathname + (params ? '?' + params : '')
  if (mode === 'empiler') window.history.pushState(null, '', url)
  else window.history.replaceState(null, '', url)
}
