// Portage des utilitaires de chemin de docsearch-ui/public/js/results.js.

/**
 * Remplace le préfixe de montage interne aux conteneurs (ex: "/sources")
 * par la valeur configurée en admin (ex: "\\serveur\partage"), pour que
 * le chemin copié soit réellement utilisable par l'utilisateur final.
 * Valeur d'affichage vide (défaut) : chemin brut inchangé.
 *
 * Le remplacement ne porte que sur le PRÉFIXE, pour ne pas toucher au
 * chemin interne d'un membre d'archive ("archive.zip::inner/f.txt").
 */
export function displayPath(filepath: string, mount: string, display: string): string {
  const base = mount || '/sources'
  if (!display || !filepath.startsWith(base)) return filepath
  // `rest` commence toujours par un séparateur : on retire un éventuel
  // séparateur final de `display` (ex: "Z:\") pour ne pas le doubler.
  const prefix = display.replace(/[\\/]+$/, '')
  let rest = filepath.slice(base.length)
  // Les chemins stockés dans Elasticsearch gardent toujours des "/"
  // (montage Linux), même quand la valeur affichée est un chemin Windows
  // — sans ça on obtiendrait "\\serveur\partage/tips/fichier.docx".
  if (display.includes('\\') && !display.includes('/')) {
    rest = rest.replace(/\//g, '\\')
  }
  return prefix + rest
}

/**
 * Dossier contenant le fichier. Pour un membre d'archive
 * ("archive.zip::inner/f.txt"), c'est celui de l'archive elle-même, pas
 * un chemin interne à celle-ci.
 */
export function dirOfPath(filepath: string): string {
  const outer = filepath.split('::')[0]
  const idx = Math.max(outer.lastIndexOf('/'), outer.lastIndexOf('\\'))
  return idx >= 0 ? outer.slice(0, idx) : outer
}

/**
 * Dernier segment d'un chemin de dossier. La facette « Dossier » garde
 * le chemin complet en valeur et en infobulle, mais n'affiche que ce
 * segment pour rester lisible dans la largeur de la colonne.
 */
export function folderBasename(path: string): string {
  const trimmed = path.replace(/[/\\]+$/, '')
  const idx = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
  return idx >= 0 ? trimmed.slice(idx + 1) : trimmed
}

/**
 * L'adresse d'un document quand son `filepath` en est une, sinon `null`.
 *
 * Tous les types de source ne rangent pas la même chose dans `filepath` :
 * une source fichier y met un chemin, une source WEB y met l'URL de la
 * page (web_indexer.py), et une source de MODULE y met ce que le module a
 * fourni — pour le module RSS, le lien de l'article. Ces deux derniers
 * cas s'affichaient en texte brut, sans moyen d'ouvrir la page.
 *
 * ⚠️  Liste blanche de schémas, et surtout pas un test du genre
 * « contient :// ». Le `:href` de Vue N'ASSAINIT RIEN : un `filepath`
 * valant « javascript:… » produirait un lien exécutable au clic. Or il
 * vient d'un tiers — l'URL d'une entrée RSS est écrite par l'éditeur du
 * flux, et en mode archive elle reste indexée indéfiniment. Le module
 * peut bien écarter ces liens à l'ingestion, le cœur ne s'y fie pas :
 * un module complémentaire est du code tiers.
 */
export function lienExterne(filepath: string | null | undefined): string | null {
  const valeur = (filepath || '').trim()
  return /^https?:\/\//i.test(valeur) ? valeur : null
}

/**
 * Copie dans le presse-papier, avec repli pour les contextes non
 * sécurisés (http:// hors localhost, ex: accès direct par IP en dev) où
 * l'API Clipboard est indisponible.
 */
export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text)
    return
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.focus()
  ta.select()
  document.execCommand('copy')
  document.body.removeChild(ta)
}

/**
 * Longueur au-delà de laquelle une adresse est abrégée à l'affichage.
 * Choisie pour tenir sur la ligne de chemin d'une carte à la largeur
 * courante, boutons de copie compris.
 */
const URL_LONGUEUR_MAX = 72

/** Élision au MILIEU : garde le début et la fin, coupe entre les deux. */
function elide(texte: string, max: number): string {
  if (texte.length <= max) return texte
  if (max <= 1) return '…'
  const tete = Math.ceil((max - 1) / 2)
  const queue = max - 1 - tete
  return texte.slice(0, tete) + '…' + (queue > 0 ? texte.slice(texte.length - queue) : '')
}

/**
 * Forme courte d'une adresse, pour le TEXTE du lien uniquement — le
 * `href`, l'infobulle et la copie gardent l'adresse entière.
 *
 * L'ellipse CSS de `.ds-result__path-text` coupait en FIN de ligne, donc
 * exactement là où une URL est informative : le nom de la page part, le
 * « https://www. » et les rubriques intermédiaires restent. On enlève
 * donc d'abord ce qui ne distingue aucun résultat d'un autre (schéma,
 * « www. », slash final), puis on élide les rubriques du milieu pour
 * garder l'hôte ET le dernier segment.
 *
 * Les paramètres de requête suivent le dernier segment et sont élidés
 * avec lui : « article.php?id=42 » reste lisible, une URL de suivi de
 * 300 caractères est coupée en son milieu.
 *
 * L'ellipse CSS reste en place derrière : elle rattrape les fenêtres
 * étroites, où même cette forme courte déborde.
 */
export function urlAbregee(url: string, max: number = URL_LONGUEUR_MAX): string {
  const sansSchema = (url || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
  const nu = sansSchema.replace(/\/+$/, '')
  if (nu.length <= max) return nu

  const finHote = nu.indexOf('/')
  // Pas de chemin du tout : il ne reste que l'hôte à couper.
  if (finHote < 0) return elide(nu, max)

  const hote = nu.slice(0, finHote)
  const chemin = nu.slice(finHote + 1)
  const dernier = chemin.slice(chemin.lastIndexOf('/') + 1)
  // Un seul segment : rien au milieu à élider, on coupe dans le segment.
  const separateur = chemin.includes('/') ? '/…/' : '/'
  const place = max - hote.length - separateur.length
  // L'hôte mange déjà toute la place : le montrer entier avec un reste
  // illisible n'aide pas, on coupe l'ensemble.
  if (place < 8) return elide(nu, max)
  return hote + separateur + elide(dernier, place)
}
