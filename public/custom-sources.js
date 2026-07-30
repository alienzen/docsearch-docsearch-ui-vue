/* Personnalisation du CONTENU des cartes de résultat, source par source.
 *
 * Comme custom-sources.css, ce fichier est servi tel quel : éditable dans
 * le conteneur (/usr/share/nginx/html/custom-sources.js) puis rechargement
 * de page, sans reconstruire l'application.
 *
 * ── Registre déclaratif, et non hook ─────────────────────────────────
 * docsearch-ui exposait `sourceCardHooks`, une fonction par source qui
 * recevait l'élément du DOM et le modifiait. Ce motif ne se transpose pas
 * à Vue : tout ce qu'un tel hook écrit est écrasé au rendu suivant —
 * changement de page, bascule de vue compacte, dépli d'une carte. Ici on
 * déclare des VALEURS, que le composant applique pendant son rendu ; la
 * personnalisation survit donc à tous ces cas.
 *
 * Clés reconnues, toutes facultatives :
 *   badge       texte d'un badge ajouté à côté de l'extension
 *   titlePrefix texte inséré devant le titre du document
 *   accent      couleur du liseré gauche de la carte (toute couleur CSS)
 *
 * Les textes sont rendus comme du TEXTE, donc échappés : y placer du HTML
 * l'afficherait littéralement. Pour ce que ce registre ne couvre pas,
 * passer par custom-sources.css.
 *
 * La clé de chaque entrée est la clé technique de la source (attribut
 * `data-source` de la carte, ou colonne « nom » du panneau
 * d'administration « Toutes les sources »).
 *
 * ── Exemple ──────────────────────────────────────────────────────────
 *
 * window.docsearchSourceCards = {
 *   sharepoint_rh: { badge: 'RH', titlePrefix: '[RH] ', accent: '#0c447c' },
 * }
 */
window.docsearchSourceCards = {}
