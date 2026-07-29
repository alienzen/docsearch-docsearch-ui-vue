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
