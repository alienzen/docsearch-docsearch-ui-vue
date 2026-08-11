<script setup lang="ts">
/**
 * Vue transverse de toutes les sources (bureautiques, SQL, web), avec
 * deux bascules INDÉPENDANTES par source :
 *  - « Recherche » : visibilité dans la recherche ;
 *  - « Collections » : autorise l'ajout de ses documents à une
 *    collection.
 * Une source peut rester cherchable tout en étant exclue des
 * collections (contenu volatile qu'on ne veut pas voir épinglé), d'où
 * deux bascules et non une.
 *
 * Aucune des deux n'affecte l'ingestion : watcher, worker SQL et worker
 * web continuent normalement.
 */
import { computed, ref } from 'vue'
import {
  getAllSources,
  setSourceCollectable,
  setSourceGroups,
  setSourceSearchable,
  type AllSourceEntry,
  type SourceType,
} from '@/api/admin'
import { useStatsPanel } from '@/composables/useStatsPanel'
import { fmtSize } from '@/utils/format'
import { useDialogs } from '@/composables/useDialogs'

const { data, error, refresh } = useStatsPanel(getAllSources)
const actionError = ref<string | null>(null)
const { prompt } = useDialogs()

const TYPE_LABELS: Record<SourceType, string> = {
  file: 'Bureautique',
  sql: 'SQL',
  web: 'Web',
}

/** Triées par nom, comme en vanilla. */
const sources = computed(() =>
  Object.entries(data.value || {}).sort(([a], [b]) => a.localeCompare(b)),
)

async function toggle(
  name: string,
  entry: AllSourceEntry,
  field: 'searchable' | 'collectable',
  checked: boolean,
) {
  const before = entry[field]
  entry[field] = checked
  actionError.value = null
  try {
    const call = field === 'searchable' ? setSourceSearchable : setSourceCollectable
    await call(name, entry.type, checked)
  } catch (e) {
    // Remet la case comme avant : afficher « activée » alors que
    // l'enregistrement a échoué induirait en erreur sur ce qui est
    // réellement visible côté recherche.
    entry[field] = before
    actionError.value = e instanceof Error ? e.message : String(e)
  }
}

async function editGroups(name: string, entry: AllSourceEntry) {
  const current = (entry.allowed_groups || []).join(', ')
  const value = await prompt(
    `Groupes AD/LDAP autorisés à voir la source « ${name} » dans la recherche, séparés par des virgules (vide = tout le monde) :`,
    current,
    { title: 'Groupes autorisés' },
  )
  if (value === null) return
  const groups = value
    .split(',')
    .map((g) => g.trim().toLowerCase())
    .filter(Boolean)
  actionError.value = null
  try {
    await setSourceGroups(name, entry.type, groups)
    await refresh()
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <AdminPanel
    id="allsources-panel"
    title="Toutes les sources"
    subtitle="documents bureautiques, web et SQL confondus"
    :error="error"
  >
    <DsfrAlert
      v-if="actionError"
      id="allsources-erreur"
      type="error"
      small
      :description="actionError"
      class="fr-mb-2w"
    />

    <div class="fr-table fr-table--bordered ds-stats__table">
      <table id="allsources-tableau">
        <thead>
          <tr>
            <th scope="col">Source</th>
            <th scope="col">Type</th>
            <th scope="col">Index ES</th>
            <th scope="col">Description</th>
            <th scope="col">Documents</th>
            <th scope="col">Taille</th>
            <th scope="col">Recherche</th>
            <th scope="col">Collections</th>
            <th scope="col">Groupes autorisés</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!sources.length">
            <td colspan="9" class="fr-hint-text">Aucune source enregistrée.</td>
          </tr>
          <tr v-for="[name, entry] in sources" :key="name" data-testid="allsources-ligne" :data-source="name">
            <td>{{ entry.label }}</td>
            <td>{{ TYPE_LABELS[entry.type] || entry.type }}</td>
            <td><code>{{ entry.es_index }}</code></td>
            <td>{{ entry.description || '' }}</td>
            <td>{{ (entry.indexed ?? 0).toLocaleString('fr-FR') }}</td>
            <td>{{ fmtSize(entry.size_bytes) }}</td>
            <td>
              <div class="fr-checkbox-group fr-checkbox-group--sm">
                <input
                  :id="`searchable-${name}`"
                  data-testid="allsources-recherche"
                  type="checkbox"
                  :checked="entry.searchable"
                  @change="
                    toggle(name, entry, 'searchable', ($event.target as HTMLInputElement).checked)
                  "
                />
                <label class="fr-label" :for="`searchable-${name}`">
                  {{ entry.searchable ? 'activée' : 'désactivée' }}
                </label>
              </div>
            </td>
            <td>
              <div class="fr-checkbox-group fr-checkbox-group--sm">
                <input
                  :id="`collectable-${name}`"
                  data-testid="allsources-collections"
                  type="checkbox"
                  :checked="entry.collectable"
                  @change="
                    toggle(name, entry, 'collectable', ($event.target as HTMLInputElement).checked)
                  "
                />
                <label class="fr-label" :for="`collectable-${name}`">
                  {{ entry.collectable ? 'autorisée' : 'bloquée' }}
                </label>
              </div>
            </td>
            <td class="ds-admin__actions">
              <span class="fr-hint-text fr-mb-0">
                {{ entry.allowed_groups?.length ? entry.allowed_groups.join(', ') : 'tout le monde' }}
              </span>
              <DsfrButton
                size="sm"
                tertiary
                no-outline
                label="Modifier"
                data-testid="allsources-groupes-modifier"
                :title="`Modifier les groupes autorisés de ${name}`"
                @click="editGroups(name, entry)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="fr-hint-text fr-mt-2w">
      « Groupes autorisés » restreint la visibilité de la source dans la recherche aux membres
      d'un des groupes AD/LDAP listés (vide = tout le monde, comportement par défaut) — n'affecte
      ni l'ingestion, ni l'accès aux documents individuels déjà partagés par ACL.
    </p>
  </AdminPanel>
</template>
