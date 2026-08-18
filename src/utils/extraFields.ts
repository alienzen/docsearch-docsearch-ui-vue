/**
 * Champs propres à une source SQL, à afficher dans la carte de résultat.
 *
 * Une source SQL projette ses colonnes dans le document Elasticsearch
 * (voir `fields` dans sql_sources_config.py) : une source « agents »
 * apporte ainsi `bureau`, `fonction`, `telephone`, `mail`, `adresse`…
 * Ces valeurs sont l'essentiel de l'information pour ce type de source —
 * un agent sans son téléphone ni son bureau n'apprend rien.
 *
 * docsearch-ui les affichait en codant DEUX noms en dur dans son gabarit
 * (`r.telephone` et `r.bureau`) : toute autre installation devait
 * modifier le code pour voir les siens. Ici, tout champ non technique
 * renvoyé par l'API est affiché, quel qu'il soit.
 */

/**
 * Clés du schéma commun à tous les documents : soit déjà rendues
 * ailleurs dans la carte, soit purement techniques. Tout le reste est
 * considéré comme un apport de la source.
 */
const TECHNIQUES = new Set([
  'id',
  'score',
  'highlight',
  'content',
  'content_vector',
  'indexed_at',
  'type',
  'acl',
  // Rendus par ailleurs dans la carte ou son en-tête.
  'title',
  'filename',
  'extension',
  'author',
  'keywords',
  'source',
  'folder',
  'filepath',
  'date_modified',
  'date_created',
  'size',
  // Dérivé du chemin par l'ingestion pour alimenter la facette
  // « Dossier » — une donnée de service, sans intérêt à l'écran.
  'folder_top',
  // Drapeau posé par l'API sur un document épinglé. Le fait est déjà dit
  // à sa place — mention en tête de bloc et badge « Mis en avant » sur la
  // carte ; ici, il s'affichait en clair, « Pinned : true » au milieu des
  // métadonnées du document.
  'pinned',
  // Identifiant de PASSE d'un module complémentaire, posé sur chaque
  // document poussé (docsearch_contract.documents.construire_document).
  // C'est la plomberie de la réconciliation de fin de passe : le cœur
  // compare ce marqueur pour savoir ce qui a disparu depuis. Il ne dit
  // rien du document, et s'affichait en clair sur la carte — « Run id :
  // 2026-08-17T15:46:47.930402+00:00-b8bb » au milieu des métadonnées.
  // Même nature que `folder_top` juste au-dessus : une donnée de service.
  'run_id',
  // Illustration d'un document poussé par un module : RENDUE AILLEURS,
  // en vignette (DocumentVignette.vue), sur la carte comme dans la fiche.
  // Laissée ici, elle s'affichait AUSSI en clair — « Image :
  // https://intranet.exemple.fr/img/une.jpg » au milieu des
  // métadonnées — et sans moyen de la masquer : `card_fields` ne
  // couvre que les sources SQL, une source de module reçoit toujours
  // une table de libellés vide.
  'image',
])

/**
 * Champs réservés aux administrateurs.
 *
 * `content_sha256` est l'empreinte de contenu posée par l'ingestion sur
 * les documents fichiers. Elle n'apprend rien à un utilisateur — 64
 * caractères hexadécimaux au milieu de ses métadonnées — mais sert à
 * l'administrateur pour rapprocher un document d'une ligne du panneau
 * des doublons, qui regroupe précisément sur ce champ.
 *
 * Ici et non dans `TECHNIQUES` : c'est un champ AFFICHABLE, sous
 * condition, pas un champ de service. Et ici plutôt qu'au cas par cas
 * chez les appelants : la carte de résultat et la fiche détail rendent
 * les mêmes champs, et deux règles à tenir alignées finissent par
 * diverger.
 *
 * ⚠️ Ce n'est pas un contrôle d'accès : la valeur reste dans la réponse
 * de l'API. Masquer un champ d'écran ne protège rien — même réserve que
 * la section « Droits d'accès » de la fiche détail.
 */
const RESERVES_ADMIN = new Set(['content_sha256'])

export type ExtraField = { key: string; label: string; value: string }

/**
 * Met un nom de champ en libellé lisible : `numero_piece` → « Numero
 * piece ». Utilisé faute de mieux, quand la source ne fournit pas de
 * libellé — seules les colonnes marquées « facette » en ont un.
 */
function libelleParDefaut(key: string): string {
  const mots = key.replace(/_/g, ' ').trim()
  return mots.charAt(0).toUpperCase() + mots.slice(1)
}

/**
 * `labels` vient de `card_fields` de /searchable-sources, alimenté par
 * `card_label` du mapping SQL. Trois états par champ :
 *
 *   absent de la table → affiché, sous un libellé dérivé du nom ;
 *   chaîne non vide    → affiché sous ce libellé ;
 *   chaîne vide        → MASQUÉ.
 *
 * C'est ce qui permet à l'administrateur d'écarter les colonnes sans
 * intérêt à l'écran (un identifiant interne, un nom déjà présent dans le
 * titre) et de corriger les libellés dérivés, qui ignorent les accents —
 * « numero_piece » ne peut pas donner « Numéro de pièce » tout seul.
 *
 * `admin` ouvre les champs de RESERVES_ADMIN. Il vaut `false` par
 * défaut : un appelant qui l'oublie masque, il ne divulgue pas.
 */
export function extraFields(
  // Un simple dictionnaire : cette fonction ne fait qu'itérer des
  // entrées, et sert aussi bien un résultat de recherche qu'une fiche
  // détail — deux types voisins mais distincts.
  result: Record<string, unknown>,
  labels: Record<string, string | null> = {},
  { admin = false }: { admin?: boolean } = {},
): ExtraField[] {
  const out: ExtraField[] = []
  for (const [key, value] of Object.entries(result)) {
    if (TECHNIQUES.has(key)) continue
    if (!admin && RESERVES_ADMIN.has(key)) continue
    // Les sous-champs ACL arrivent aplatis (« acl.public », « acl.groups »).
    if (key.startsWith('acl')) continue
    if (value === null || value === undefined || value === '') continue
    // Un tableau ou un objet n'a pas de rendu évident sur une ligne de
    // carte : on s'abstient plutôt que d'afficher « [object Object] ».
    if (typeof value === 'object') continue
    // Chaîne vide = masqué. `key in labels` distingue bien ce cas de
    // « champ inconnu de la table », qui reste affiché.
    if (key in labels && labels[key] === '') continue
    out.push({ key, label: labels[key] || libelleParDefaut(key), value: String(value) })
  }
  // Les colonnes explicitement libellées d'abord : ce sont celles que
  // l'administrateur a désignées comme importantes.
  return out.sort((a, b) => Number(!!labels[b.key]) - Number(!!labels[a.key]))
}
