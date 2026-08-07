/**
 * Identité de la livraison de l'INTERFACE.
 *
 * Les trois constantes sont remplacées textuellement par Vite au build
 * (voir le bloc `define` de vite.config.ts) : la version produit vient
 * du fichier VERSION du dépôt, l'estampille de build de ./manage.sh
 * build, qui la relève dans git.
 *
 * ⚠️  C'est bien la version de CE bundle, pas celle de l'API. Les trois
 * dépôts se déploient indépendamment, et un conteneur ui-vue oublié lors
 * d'une mise à jour est précisément ce que cet affichage doit rendre
 * visible : afficher la version renvoyée par l'API le masquerait. La
 * comparaison entre composants se fait en administration, dans le
 * panneau « État des composants ».
 */
export const VERSION = __DOCSEARCH_VERSION__
export const COMMIT = __DOCSEARCH_COMMIT__
export const BUILD_DATE = __DOCSEARCH_BUILD_DATE__

/** « 2.2.0 » — pied de page, mention courte. */
export const versionCourte = `Version ${VERSION}`

/**
 * « Version 2.2.0 — build a1b2c3d du 07/08/2026 » : la forme complète,
 * pour les endroits où l'utilisateur doit pouvoir la recopier dans un
 * signalement. La date est formatée localement, l'estampille étant en
 * ISO 8601 dans le bundle.
 */
export const versionComplete = (() => {
  if (COMMIT === 'inconnu') return versionCourte
  let date = ''
  const parsed = new Date(BUILD_DATE)
  if (!Number.isNaN(parsed.getTime())) date = ` du ${parsed.toLocaleDateString('fr-FR')}`
  return `${versionCourte} — build ${COMMIT}${date}`
})()
