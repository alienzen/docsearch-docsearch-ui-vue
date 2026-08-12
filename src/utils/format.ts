// Portage de fmtSize()/extLabel() de docsearch-ui/public/js/search.js.

/** Taille de fichier lisible (« 12 Ko », « 1.4 Mo »), « — » si inconnue. */
export function fmtSize(bytes: number | null | undefined): string {
  if (!bytes) return '—'
  if (bytes < 1024) return bytes + ' o'
  if (bytes < 1048576) return (bytes / 1024).toFixed(0) + ' Ko'
  return (bytes / 1048576).toFixed(1) + ' Mo'
}

/**
 * Durée lisible à partir de millisecondes (« 87 ms », « 1,24 s »). Le
 * seuil est la seconde : en dessous, les millisecondes se lisent d'un
 * coup d'œil et « 0,087 s » ne dit rien de plus ; au-dessus, personne ne
 * compte en milliers de millisecondes. Deux décimales à la seconde, pas
 * trois : la mesure ne prétend pas à la milliseconde près, l'aller-retour
 * réseau n'y étant même pas compté.
 */
export function fmtDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '—'
  if (ms < 1000) return `${Math.round(ms).toLocaleString('fr-FR')} ms`
  return `${(ms / 1000).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} s`
}

/** « .pdf » → « PDF ». */
export function extLabel(ext: string | null | undefined): string {
  return (ext || '').replace('.', '').toUpperCase() || '—'
}

/**
 * Date et heure lisibles. Repli sur la chaîne brute si elle n'est pas
 * analysable, plutôt que d'afficher « Invalid Date ».
 */
export function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleString('fr-FR')
}

/**
 * Déclenche le téléchargement d'un blob côté navigateur. Isolé ici (et
 * hors de src/api/) pour que la couche API reste sans manipulation du
 * DOM, donc testable sans navigateur.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
