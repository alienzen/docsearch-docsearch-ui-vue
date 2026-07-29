<script setup lang="ts">
/**
 * Sources fichiers : un répertoire indexé = un index Elasticsearch
 * dédié.
 */
import { ref } from 'vue'
import {
  createFileSource,
  deleteFileSource,
  getFileSources,
  setFileSourceOcr,
  type FileSource,
} from '@/api/admin'
import { useStatsPanel } from '@/composables/useStatsPanel'
import { useSourceField } from '@/composables/useSourceField'

const emit = defineEmits<{ changed: [] }>()

const { data, error, refresh } = useStatsPanel(getFileSources)
const actionError = ref<string | null>(null)

async function reload() {
  await refresh()
  // La liste alimente les sélecteurs des autres panneaux (types de
  // fichiers, filtres, scan) : ils doivent la revoir après un ajout ou
  // un retrait.
  emit('changed')
}

const { error: fieldError, edit } = useSourceField(reload)

const form = ref({ name: '', es_index: '', subfolder: '', label: '', description: '' })

async function run(action: () => Promise<unknown>) {
  actionError.value = null
  try {
    await action()
    await reload()
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : String(e)
  }
}

async function toggleOcr(name: string, source: FileSource, enabled: boolean) {
  const before = source.ocr_enabled
  source.ocr_enabled = enabled
  actionError.value = null
  try {
    await setFileSourceOcr(name, enabled)
  } catch (e) {
    source.ocr_enabled = before
    actionError.value = e instanceof Error ? e.message : String(e)
  }
}

function remove(name: string) {
  if (
    !confirm(
      `Retirer la source « ${name} » ? Son index Elasticsearch et ses documents ne seront PAS supprimés.`,
    )
  )
    return
  return run(() => deleteFileSource(name))
}

function add() {
  const { name, es_index, subfolder, label, description } = form.value
  if (!name.trim() || !es_index.trim()) {
    actionError.value = 'Nom et index ES sont requis.'
    return
  }
  return run(async () => {
    await createFileSource({
      name: name.trim(),
      es_index: es_index.trim(),
      subfolder: subfolder.trim() || null,
      label: label.trim() || null,
      description: description.trim() || null,
    })
    form.value = { name: '', es_index: '', subfolder: '', label: '', description: '' }
  })
}
</script>

<template>
  <AdminPanel
    id="filesources-panel"
    title="Sources fichiers"
    subtitle="un répertoire indexé = un index Elasticsearch dédié"
    :error="error"
  >
    <DsfrAlert
      v-if="actionError || fieldError"
      type="error"
      small
      :description="actionError || fieldError || ''"
      class="fr-mb-2w"
    />

    <div class="fr-table fr-table--bordered ds-stats__table">
      <table>
        <thead>
          <tr>
            <th scope="col">Nom</th>
            <th scope="col">Libellé</th>
            <th scope="col">Index ES</th>
            <th scope="col">Dossier</th>
            <th scope="col">Description</th>
            <th scope="col">OCR (FR)</th>
            <th scope="col"><span class="fr-sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(source, name) in data || {}" :key="name">
            <td><code>{{ name }}</code></td>
            <td>{{ source.label || name }}</td>
            <td><code>{{ source.es_index }}</code></td>
            <td>{{ source.folder }}</td>
            <td>{{ source.description || '' }}</td>
            <td>
              <div class="fr-checkbox-group fr-checkbox-group--sm">
                <input
                  :id="`ocr-${name}`"
                  type="checkbox"
                  :checked="source.ocr_enabled"
                  @change="
                    toggleOcr(String(name), source, ($event.target as HTMLInputElement).checked)
                  "
                />
                <label class="fr-label" :for="`ocr-${name}`">
                  {{ source.ocr_enabled ? 'activé' : 'désactivé' }}
                </label>
              </div>
            </td>
            <td class="ds-admin__actions">
              <DsfrButton
                size="sm"
                tertiary
                no-outline
                label="Libellé"
                @click="edit('file', String(name), 'label', source.label || String(name))"
              />
              <DsfrButton
                size="sm"
                tertiary
                no-outline
                label="Description"
                @click="edit('file', String(name), 'description', source.description || '')"
              />
              <!-- « documents » est la source par défaut de
                   l'installation : la retirer laisserait les autres
                   panneaux sans sélection de repli. -->
              <DsfrButton
                v-if="name !== 'documents'"
                size="sm"
                tertiary
                label="Retirer"
                @click="remove(String(name))"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <h3 class="fr-h6 fr-mt-3w">Ajouter une source</h3>
    <div class="ds-admin__row">
      <div class="fr-input-group fr-mb-0">
        <label class="fr-label fr-sr-only" for="new-file-name">Nom</label>
        <input
          id="new-file-name"
          v-model="form.name"
          class="fr-input fr-input--sm"
          type="text"
          placeholder="nom (ex : finance)"
        />
      </div>
      <div class="fr-input-group fr-mb-0">
        <label class="fr-label fr-sr-only" for="new-file-index">Index ES</label>
        <input
          id="new-file-index"
          v-model="form.es_index"
          class="fr-input fr-input--sm"
          type="text"
          placeholder="index ES (ex : finance_docs)"
        />
      </div>
    </div>
    <div class="ds-admin__row fr-mt-1w">
      <div class="fr-input-group fr-mb-0">
        <label class="fr-label fr-sr-only" for="new-file-subfolder">Sous-dossier</label>
        <input
          id="new-file-subfolder"
          v-model="form.subfolder"
          class="fr-input fr-input--sm"
          type="text"
          placeholder="sous-dossier (défaut : = nom)"
        />
      </div>
      <div class="fr-input-group fr-mb-0">
        <label class="fr-label fr-sr-only" for="new-file-label">Libellé</label>
        <input
          id="new-file-label"
          v-model="form.label"
          class="fr-input fr-input--sm"
          type="text"
          placeholder="libellé (optionnel)"
        />
      </div>
    </div>
    <div class="ds-admin__row fr-mt-1w">
      <div class="fr-input-group fr-mb-0">
        <label class="fr-label fr-sr-only" for="new-file-description">Description</label>
        <input
          id="new-file-description"
          v-model="form.description"
          class="fr-input fr-input--sm"
          type="text"
          placeholder="description (optionnel)"
        />
      </div>
      <DsfrButton size="sm" label="Ajouter" @click="add" />
    </div>

    <p class="fr-hint-text fr-mt-2w">
      Créez d'abord le sous-dossier sur l'hôte (SOURCES_ROOT/&lt;nom&gt;), puis enregistrez-le ici —
      le watcher commence à l'observer sous ~5 s, sans redémarrage. Lancez ensuite l'indexation
      initiale depuis le panneau « Indexation ».
    </p>
    <p class="fr-hint-text">
      OCR (Tesseract, français) : reconnaissance de texte pour les PDF scannés et les images de
      cette source — coûteux en CPU, à réserver aux sources qui en ont besoin. N'affecte que les
      documents indexés après activation, il n'y a pas de réextraction rétroactive.
    </p>
  </AdminPanel>
</template>
