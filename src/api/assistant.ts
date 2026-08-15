/**
 * Assistant de recherche — module complémentaire servi sous /ext/assistant/.
 *
 * ⚠️ Ce n'est PAS docsearch-api. Le module a son propre conteneur, son
 * propre cycle de vie, et peut ne pas être installé du tout : c'est le
 * seul appel de l'interface qui doit traiter « service absent » comme un
 * cas normal, pas comme une panne (voir `AssistantIndisponible`).
 *
 * Le préfixe /ext/ est proxifié comme les routes d'API — il est déclaré
 * dans les DEUX nginx.conf et dans API_ROUTES de vite.config.ts. Ajouter
 * un chemin ici sans l'ajouter là est LA source des bugs « fonctionne en
 * dev, 404 dans le conteneur ».
 */

/** Segment de réponse ; `strong` met en valeur sans passer par du HTML. */
export type SegmentReponse = { text: string; strong?: boolean }

export type ReponseAssistant = {
  answer: SegmentReponse[]
  sources: string[]
  total: number
}

/**
 * Le module n'est pas installé, ou il est arrêté. Distingué d'une erreur
 * ordinaire parce que l'écran en dit autre chose : il n'y a rien à
 * réessayer, il y a un module à installer.
 */
export class AssistantIndisponible extends Error {}

export async function poserQuestion(question: string): Promise<ReponseAssistant> {
  let reponse: Response
  try {
    reponse = await fetch('/ext/assistant/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Le cookie de session part avec la requête : c'est lui que le
      // module vérifie contre le JWKS de l'API, et qu'il reporte ensuite
      // sur /search pour que l'ACL s'applique.
      credentials: 'same-origin',
      body: JSON.stringify({ question }),
    })
  } catch (e) {
    throw new AssistantIndisponible(String(e))
  }

  // 404 : aucun fragment nginx ne route /ext/assistant/ — le module n'est
  // pas installé. 502/503 : il est déclaré mais ne répond pas.
  if (reponse.status === 404 || reponse.status === 502 || reponse.status === 503) {
    throw new AssistantIndisponible(`HTTP ${reponse.status}`)
  }
  if (reponse.status === 401) {
    throw new Error('Votre session a expiré. Rechargez la page pour vous reconnecter.')
  }
  if (!reponse.ok) {
    throw new Error(`L'assistant a répondu ${reponse.status}.`)
  }
  return (await reponse.json()) as ReponseAssistant
}
