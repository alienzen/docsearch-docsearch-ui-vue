/**
 * Découpe un extrait renvoyé par Elasticsearch en segments, en isolant
 * les passages surlignés.
 *
 * L'API demande à Elasticsearch d'entourer les termes trouvés de
 * `<mark class="highlight">…</mark>` (voir les `pre_tags`/`post_tags` de
 * search_api.py) mais le reste du contenu du document n'est PAS échappé.
 * docsearch-ui insérait ces extraits tels quels via innerHTML : un
 * document dont le contenu (ou le titre) contient du HTML pouvait donc
 * injecter du balisage dans la page. Plutôt que de reproduire ça avec un
 * `v-html`, on ne retient que le seul balisage attendu — la balise de
 * surlignage — et tout le reste est rendu comme du texte par Vue, donc
 * échappé.
 */
export type HighlightSegment = {
  text: string
  marked: boolean
}

// `<mark class="highlight">` est ce qu'émet l'API aujourd'hui ; `<em>`
// est la valeur par défaut d'Elasticsearch, acceptée aussi pour ne pas
// dépendre d'un réglage qui pourrait changer côté serveur.
const MARK_RE = /<mark\b[^>]*>([\s\S]*?)<\/mark>|<em>([\s\S]*?)<\/em>/g

/** Restaure les entités que produit Elasticsearch dans ses extraits. */
function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

export function parseHighlight(fragment: string): HighlightSegment[] {
  const segments: HighlightSegment[] = []
  let lastIndex = 0
  for (const match of fragment.matchAll(MARK_RE)) {
    const index = match.index ?? 0
    if (index > lastIndex) {
      segments.push({ text: decodeEntities(fragment.slice(lastIndex, index)), marked: false })
    }
    // Un seul des deux groupes est renseigné, selon la balise trouvée.
    segments.push({ text: decodeEntities(match[1] ?? match[2]), marked: true })
    lastIndex = index + match[0].length
  }
  if (lastIndex < fragment.length) {
    segments.push({ text: decodeEntities(fragment.slice(lastIndex)), marked: false })
  }
  return segments
}

/** Les extraits d'un résultat, assemblés comme en vanilla (« … »). */
export function parseHighlights(fragments: string[]): HighlightSegment[] {
  return parseHighlight(fragments.join(' … '))
}
