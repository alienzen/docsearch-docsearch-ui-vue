// Portage de fmtSize()/extLabel() de docsearch-ui/public/js/search.js.

/** Taille de fichier lisible (« 12 Ko », « 1.4 Mo »), « — » si inconnue. */
export function fmtSize(bytes: number | null | undefined): string {
  if (!bytes) return '—'
  if (bytes < 1024) return bytes + ' o'
  if (bytes < 1048576) return (bytes / 1024).toFixed(0) + ' Ko'
  return (bytes / 1048576).toFixed(1) + ' Mo'
}

/** « .pdf » → « PDF ». */
export function extLabel(ext: string | null | undefined): string {
  return (ext || '').replace('.', '').toUpperCase() || '—'
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
