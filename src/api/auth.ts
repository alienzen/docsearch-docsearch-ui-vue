/**
 * Appels d'authentification — utilisés par la page de connexion et par le
 * bouton de déconnexion.
 *
 * Volontairement en dehors de `api()` : ces routes ont besoin de lire le
 * code HTTP (401, 403, 429, 501, 503) pour décider quoi faire, là où
 * `api()` les fond toutes dans une `ApiError`. Et surtout, `api()` rejoue
 * un 401 après renouvellement puis redirige vers la page de connexion —
 * comportement absurde ici, où le 401 EST la réponse attendue.
 */

export interface Session {
  user: string
  display_name: string
  email: string | null
  groups: string[]
  is_admin: boolean
  auth_method: string
  expires_in: number
}

/** Marqueur anti-boucle : voir `ssoAutorise()` plus bas. */
const CLE_DECONNEXION = 'docsearch:sso-desactive'

/**
 * Mémoire d'un 501 pour la durée de l'onglet.
 *
 * Deux usages, et le second n'est pas une optimisation : il évite de
 * proposer « Se connecter avec ma session Windows » sur une installation
 * où le SSO est éteint — un bouton qui ne peut rien faire. Le cas se voit
 * juste après une déconnexion, où l'on n'a pas le droit de sonder le
 * serveur (ce serait rouvrir la session qu'on vient de fermer) : la seule
 * façon de savoir est de se souvenir de la réponse précédente.
 *
 * Portée « onglet », comme le marqueur anti-boucle : si un administrateur
 * active le SSO entre-temps, il suffit de rouvrir un onglet.
 */
const CLE_SSO_ETEINT = 'docsearch:sso-eteint'

export class ErreurConnexion extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ErreurConnexion'
    this.status = status
  }
}

async function detail(reponse: Response, defaut: string): Promise<string> {
  const corps = await reponse.json().catch(() => ({}) as { detail?: string })
  return typeof corps.detail === 'string' && corps.detail ? corps.detail : defaut
}

export async function seConnecter(identifiant: string, motDePasse: string): Promise<Session> {
  const reponse = await fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifiant, mot_de_passe: motDePasse }),
  })
  if (!reponse.ok) {
    throw new ErreurConnexion(
      await detail(reponse, 'Connexion impossible.'),
      reponse.status,
    )
  }
  // Une connexion réussie lève le marqueur : la personne a choisi ce
  // compte-ci, le SSO peut reprendre la main aux prochains chargements.
  sessionStorage.removeItem(CLE_DECONNEXION)
  return reponse.json()
}

export async function seDeconnecter(): Promise<void> {
  await fetch('/auth/logout', { method: 'POST' }).catch(() => undefined)
  // ⚠️  SANS CE MARQUEUR, LA FONCTIONNALITÉ EST INUTILISABLE : le SSO
  // reconnecterait au rechargement suivant, et personne ne pourrait plus
  // jamais atteindre le formulaire — ni changer de compte. La portée
  // « onglet » de sessionStorage fait que la connexion automatique
  // reprend naturellement à la prochaine ouverture.
  sessionStorage.setItem(CLE_DECONNEXION, '1')
}

export function ssoAutorise(): boolean {
  return sessionStorage.getItem(CLE_DECONNEXION) === null
}

/** Le serveur a déjà répondu 501 dans cet onglet : inutile de resonder. */
export function ssoConnuEteint(): boolean {
  return sessionStorage.getItem(CLE_SSO_ETEINT) !== null
}

export function autoriserSsoANouveau(): void {
  sessionStorage.removeItem(CLE_DECONNEXION)
}

/** Réponse de la tentative SSO, telle que la page de connexion la traite. */
export type ResultatSso =
  | { etat: 'connecte'; session: Session }
  /** 501 — le SSO n'est pas activé sur cette installation. */
  | { etat: 'eteint' }
  /** 401 — défi non relevé : poste hors domaine ou navigateur non configuré. */
  | { etat: 'indisponible' }
  /** 403 — ticket valide, mais pas membre du groupe d'accès. */
  | { etat: 'refuse'; message: string }
  /** 503 — keytab, annuaire ou clés indisponibles : une panne, à afficher. */
  | { etat: 'panne'; message: string }

/**
 * Tente la connexion automatique par ticket Kerberos.
 *
 * La tentative EST la découverte : aucun endpoint de capacités n'est
 * interrogé d'abord, ce qui économise un aller-retour sur toute
 * installation — et évite d'avoir à tenir un second réglage côté client.
 *
 * `credentials: 'same-origin'` est indispensable : sans lui, le
 * navigateur refuse de relever un défi d'authentification sur une requête
 * lancée en JavaScript.
 */
export async function tenterSso(): Promise<ResultatSso> {
  let reponse: Response
  try {
    reponse = await fetch('/auth/login/kerberos', { credentials: 'same-origin' })
  } catch {
    // Réseau coupé, requête annulée : indiscernable d'un défi non relevé,
    // et traité pareil — on retombe sur le formulaire.
    return { etat: 'indisponible' }
  }

  if (reponse.ok) {
    sessionStorage.removeItem(CLE_DECONNEXION)
    return { etat: 'connecte', session: await reponse.json() }
  }
  if (reponse.status === 501) {
    sessionStorage.setItem(CLE_SSO_ETEINT, '1')
    return { etat: 'eteint' }
  }
  if (reponse.status === 403) {
    return { etat: 'refuse', message: await detail(reponse, 'Accès refusé.') }
  }
  if (reponse.status === 503) {
    return { etat: 'panne', message: await detail(reponse, 'Service indisponible.') }
  }
  return { etat: 'indisponible' }
}
