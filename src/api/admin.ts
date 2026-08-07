import { api } from './client'

// Endpoints du panneau d'administration.
//
// À noter : /admin/ui-config et /admin/engagement-config sont en
// ÉCRITURE seule (405 en GET). Leur lecture passe par les endpoints
// publics /ui-config et /engagement-config, déjà couverts par
// useUiConfigStore — c'est ce que faisait admin.html.

// ── État des composants ───────────────────────────────────────
export type ClusterStatus = {
  up?: boolean
  status?: string
}

/**
 * Identité d'un composant DocSearch déployé — voir
 * docsearch-api/app/version.py. `source` précise d'où vient la valeur
 * quand ce n'est pas le composant lui-même qui la rapporte (l'ingestion
 * passe par le battement de cœur du watcher).
 */
export type ComponentVersion = {
  version?: string
  commit?: string
  build_date?: string
  source?: string
}

export type AdminStatus = {
  elasticsearch?: ClusterStatus
  redis?: { up?: boolean }
  kafka?: { up?: boolean }
  tika?: { up_count?: number; total?: number }
  workers?: { active_workers?: number; pending_documents?: number }
  watcher?: { alive?: boolean; last_seen_seconds_ago?: number | null }
  /**
   * Clés « api » et « ingestion ». L'interface ne s'y trouve pas : sa
   * version est figée dans son propre bundle (voir src/version.ts).
   * « ingestion » est absente tant qu'aucun battement de watcher n'a été
   * reçu, et d'un battement écrit par une version antérieure à 2.2.0.
   */
  versions?: Record<string, ComponentVersion>
  sources?: unknown
}

export function getStatus(): Promise<AdminStatus> {
  return api<AdminStatus>('/admin/status')
}

// ── Types de fichiers ─────────────────────────────────────────
export type FiletypeRule = {
  enabled: boolean
  max_size_mb?: number | null
}

/** {extension: règle} — « default » est la règle de repli, non supprimable. */
export function getFiletypes(source: string): Promise<Record<string, FiletypeRule>> {
  return api(`/admin/filetypes?source=${encodeURIComponent(source)}`)
}

export function saveFiletype(
  ext: string,
  rule: FiletypeRule & { source: string },
): Promise<unknown> {
  return api(`/admin/filetypes/${ext}`, { method: 'POST', body: JSON.stringify(rule) })
}

export function deleteFiletype(ext: string, source: string): Promise<unknown> {
  return api(`/admin/filetypes/${ext}?source=${encodeURIComponent(source)}`, { method: 'DELETE' })
}

export function resetFiletypes(source: string): Promise<unknown> {
  return api(`/admin/filetypes/reset?source=${encodeURIComponent(source)}`, { method: 'POST' })
}

// ── Paramètres opérationnels ──────────────────────────────────
export function getConfig(): Promise<Record<string, number | string>> {
  return api('/admin/config')
}

/**
 * `String(value)` n'est pas décoratif : le modèle ConfigUpdate de l'API
 * déclare `value: str`, et Vue convertit tout seul la valeur d'un
 * `<input type="number">` lié par `v-model` — sans qu'on ait demandé le
 * modificateur `.number`. Envoyer le nombre brut vaut donc 422, avec un
 * `detail` en liste que l'écran affichait « [object Object] ».
 */
export function saveConfigKey(key: string, value: string | number): Promise<unknown> {
  return api(`/admin/config/${key}`, {
    method: 'POST',
    body: JSON.stringify({ value: String(value) }),
  })
}

export function resetConfig(): Promise<unknown> {
  return api('/admin/config/reset', { method: 'POST' })
}

// ── Bascules d'interface et de satisfaction (écriture) ────────
export function saveEngagementConfig(patch: Record<string, boolean>): Promise<unknown> {
  return api('/admin/engagement-config', { method: 'POST', body: JSON.stringify(patch) })
}

export function saveUiConfig(patch: Record<string, unknown>): Promise<unknown> {
  return api('/admin/ui-config', { method: 'POST', body: JSON.stringify(patch) })
}

// ── Sources ───────────────────────────────────────────────────
/** Type d'une source, qui détermine l'endpoint à viser. */
export type SourceType = 'file' | 'sql' | 'web'

export type AllSourceEntry = {
  type: SourceType
  label: string
  description?: string
  es_index?: string
  indexed?: number
  size_bytes?: number
  /** Visibilité de la source dans la recherche. */
  searchable?: boolean
  /** Autorise l'ajout de ses documents à une collection. */
  collectable?: boolean
  allowed_groups?: string[]
  [key: string]: unknown
}

/** Vue unifiée : {nom: source}, fichiers, SQL et web confondus. */
export function getAllSources(): Promise<Record<string, AllSourceEntry>> {
  return api('/admin/all-sources')
}

export function setSourceSearchable(
  name: string,
  type: SourceType,
  searchable: boolean,
): Promise<unknown> {
  return api(`/admin/all-sources/${encodeURIComponent(name)}/searchable?type=${type}`, {
    method: 'POST',
    body: JSON.stringify({ searchable }),
  })
}

export function setSourceCollectable(
  name: string,
  type: SourceType,
  collectable: boolean,
): Promise<unknown> {
  return api(`/admin/all-sources/${encodeURIComponent(name)}/collectable?type=${type}`, {
    method: 'POST',
    body: JSON.stringify({ collectable }),
  })
}

/**
 * Groupes AD/LDAP autorisés à VOIR la source dans la recherche. Vide =
 * tout le monde. N'affecte ni l'ingestion, ni l'accès aux documents
 * individuels déjà partagés par ACL.
 */
export function setSourceGroups(
  name: string,
  type: SourceType,
  allowedGroups: string[],
): Promise<unknown> {
  return api(`/admin/all-sources/${encodeURIComponent(name)}/groups?type=${type}`, {
    method: 'POST',
    body: JSON.stringify({ allowed_groups: allowedGroups }),
  })
}

export type FileSource = {
  es_index: string
  /** Sous-dossier sous SOURCES_MOUNT. */
  folder?: string
  label?: string
  description?: string
  /** OCR (Tesseract, français) pour les PDF scannés et les images. */
  ocr_enabled?: boolean
  [key: string]: unknown
}

export function getFileSources(): Promise<Record<string, FileSource>> {
  return api('/admin/file-sources')
}

export function createFileSource(body: Record<string, unknown>): Promise<unknown> {
  return api('/admin/file-sources', { method: 'POST', body: JSON.stringify(body) })
}

export function deleteFileSource(name: string): Promise<unknown> {
  return api(`/admin/file-sources/${encodeURIComponent(name)}`, { method: 'DELETE' })
}

/**
 * Active l'OCR pour une source. Coûteux en CPU, et sans effet
 * rétroactif : seuls les documents indexés APRÈS activation en
 * bénéficient.
 */
export function setFileSourceOcr(name: string, ocrEnabled: boolean): Promise<unknown> {
  return api(`/admin/file-sources/${encodeURIComponent(name)}/ocr`, {
    method: 'POST',
    body: JSON.stringify({ ocr_enabled: ocrEnabled }),
  })
}

export type TreeEntry = {
  name: string
  path: string
  type: 'dir' | 'file'
  /** Exclu par un filtre de sous-dossier. Prime sur `included`. */
  excluded?: boolean
  /** Correspond explicitement à un motif de liste blanche. */
  included?: boolean
}

/**
 * Un NIVEAU de l'arborescence d'une source — jamais un dump récursif :
 * la page reste utilisable sur une source à des dizaines de milliers de
 * fichiers, au prix d'un aller-retour par dépliage.
 */
export function getSourceTree(source: string, path: string): Promise<{ entries: TreeEntry[] }> {
  return api<{ entries: TreeEntry[] }>(
    `/admin/file-sources/${encodeURIComponent(source)}/tree?path=${encodeURIComponent(path)}`,
  )
}

/** Types Elasticsearch proposés pour une colonne SQL. */
export const SQL_ES_TYPES = ['keyword', 'text', 'long', 'double', 'date', 'boolean'] as const
export type SqlEsType = (typeof SQL_ES_TYPES)[number]

/**
 * Seuls keyword et boolean peuvent servir de facette : une agrégation
 * « terms » n'est pas possible sur les autres types (voir
 * _validate_fields côté API).
 */
export function isFacetable(type: string): boolean {
  return type === 'keyword' || type === 'boolean'
}

export type SqlField = {
  column: string
  es_field: string
  es_type: SqlEsType
  analyzer?: string | null
  facet?: boolean
  facet_label?: string | null
  /**
   * Libellé du champ dans la carte de résultat. `null`/absent = libellé
   * dérivé du nom, texte = ce libellé, chaîne vide = champ masqué.
   */
  card_label?: string | null
}

export type SqlSource = {
  db_type: 'postgresql' | 'mysql'
  connection_ref: string
  query: string
  id_column: string
  es_index: string
  fields: SqlField[]
  poll_interval_seconds: number
  label?: string
  description?: string
}

export function getSqlSources(): Promise<Record<string, SqlSource>> {
  return api('/admin/sql-sources')
}

export function createSqlSource(body: SqlSource & { name: string }): Promise<unknown> {
  return api('/admin/sql-sources', { method: 'POST', body: JSON.stringify(body) })
}

export function deleteSqlSource(name: string): Promise<unknown> {
  return api(`/admin/sql-sources/${encodeURIComponent(name)}`, { method: 'DELETE' })
}

/**
 * DSN chiffré (Fernet) stocké dans Redis. `hint` est tout ce qui reste
 * consultable après enregistrement : schéma et hôte, jamais les
 * identifiants — le DSN lui-même n'est plus jamais réaffiché.
 */
export type SqlDsn = { name: string; hint: string }

export function getSqlDsns(): Promise<SqlDsn[]> {
  return api<SqlDsn[]>('/admin/sql-dsns')
}

export function createSqlDsn(name: string, dsn: string): Promise<unknown> {
  return api('/admin/sql-dsns', { method: 'POST', body: JSON.stringify({ name, dsn }) })
}

export function deleteSqlDsn(name: string): Promise<unknown> {
  return api(`/admin/sql-dsns/${encodeURIComponent(name)}`, { method: 'DELETE' })
}

export function getWebSources(): Promise<Record<string, Record<string, unknown>>> {
  return api('/admin/web-sources')
}

export function createWebSource(body: Record<string, unknown>): Promise<unknown> {
  return api('/admin/web-sources', { method: 'POST', body: JSON.stringify(body) })
}

export function deleteWebSource(name: string): Promise<unknown> {
  return api(`/admin/web-sources/${encodeURIComponent(name)}`, { method: 'DELETE' })
}

export function setWebSourcePaused(name: string, paused: boolean): Promise<unknown> {
  return api(`/admin/web-sources/${encodeURIComponent(name)}/pause`, {
    method: 'POST',
    body: JSON.stringify({ paused }),
  })
}

/**
 * Libellé et description d'une source. L'endpoint dépend du type, d'où
 * ce paramètre plutôt qu'une route unique.
 */
export function setSourceField(
  type: SourceType,
  name: string,
  field: 'label' | 'description',
  value: string,
): Promise<unknown> {
  const base = { file: '/admin/file-sources', sql: '/admin/sql-sources', web: '/admin/web-sources' }[
    type
  ]
  return api(`${base}/${encodeURIComponent(name)}/${field}`, {
    method: 'POST',
    // La clé du corps est le nom du champ lui-même ({label: …} ou
    // {description: …}), pas un « value » générique.
    body: JSON.stringify({ [field]: value }),
  })
}

// ── Filtres de sous-dossiers ──────────────────────────────────
export type PathFilters = { excluded: string[]; included: string[] }

export function getPathFilters(source: string): Promise<PathFilters> {
  return api(`/admin/path-filters?source=${encodeURIComponent(source)}`)
}

export function addPathFilter(
  kind: 'include' | 'exclude',
  source: string,
  pattern: string,
): Promise<unknown> {
  return api(`/admin/path-filters/${kind}`, {
    method: 'POST',
    body: JSON.stringify({ source, pattern }),
  })
}

export function removePathFilter(source: string, pattern: string): Promise<unknown> {
  return api('/admin/path-filters/remove', {
    method: 'POST',
    body: JSON.stringify({ source, pattern }),
  })
}

/**
 * Purge de l'index selon un motif. `dryRun` compte sans supprimer —
 * l'interface s'en sert pour montrer combien de documents seraient
 * touchés AVANT de demander confirmation. Les fichiers sur le disque ne
 * sont jamais touchés, seulement l'index.
 */
export function purgePath(
  source: string,
  pattern: string,
  dryRun: boolean,
): Promise<{ matched: number }> {
  return api<{ matched: number }>('/admin/purge-path', {
    method: 'POST',
    body: JSON.stringify({ source, pattern, dry_run: dryRun }),
  })
}

// ── Indexation ────────────────────────────────────────────────
/**
 * Publie les fichiers d'UNE source sur Kafka pour indexation. Ne bloque
 * pas : la progression se suit dans « État des composants ».
 */
export function startScan(
  source: string,
  subfolder: string | null,
): Promise<{ source: string; subfolder: string }> {
  return api<{ source: string; subfolder: string }>('/admin/scan', {
    method: 'POST',
    body: JSON.stringify({ source, subfolder }),
  })
}
