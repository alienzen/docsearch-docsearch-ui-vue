/**
 * Remonte la fenêtre en haut de la page.
 *
 * Partagé par le raccourci « h » et par le changement de page de
 * résultats : la pagination du DSFR se trouve en BAS de la liste, et
 * l'actionner laissait le lecteur en bas de la page suivante, devant
 * ses derniers résultats.
 *
 * Le défilement part sans attendre la réponse du serveur : la nouvelle
 * liste se construit là où le regard est déjà, et l'estompage d'attente
 * porté par #resultats reste visible pendant l'appel.
 *
 * D'où le défaut INSTANTANÉ, alors que le raccourci « h » anime sa
 * remontée. Le changement de page remplace la liste entière : il n'y a
 * aucune continuité visuelle à préserver, et animer le retour depuis le
 * bas d'une page de vingt résultats ne ferait que retarder la lecture de
 * la suivante. « h » anime parce que, là, le contenu reste le même — le
 * déplacement est justement ce que l'animation donne à comprendre.
 */
export function remonterEnHaut(comportement: ScrollBehavior = 'instant') {
  window.scrollTo({ top: 0, behavior: comportement })
}
