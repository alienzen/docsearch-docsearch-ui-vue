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
import { useDialogs } from '@/composables/useDialogs'

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

/**
 * Le refus de la création a son propre bandeau, DANS la modale : celui
 * du panneau (`actionError`, partagé avec le retrait et l'OCR)
 * s'afficherait derrière elle, donc nulle part.
 */
const formError = ref<string | null>(null)
/** La modale de création est ouverte. */
const creating = ref(false)

function blankForm() {
  return { name: '', es_index: '', subfolder: '', label: '', description: '' }
}

const form = ref(blankForm())

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

async function remove(name: string) {
  const ok = await confirm(
    `Retirer la source « ${name} » ? Son index Elasticsearch et ses documents ne seront PAS supprimés.`,
    { title: 'Retirer la source', confirmLabel: 'Retirer' },
  )
  if (!ok) return
  return run(() => deleteFileSource(name))
}

/** Ouvre la modale sur un formulaire vierge. */
function openForm() {
  form.value = blankForm()
  formError.value = null
  actionError.value = null
  creating.value = true
}

async function add() {
  const { name, es_index, subfolder, label, description } = form.value
  if (!name.trim() || !es_index.trim()) {
    formError.value = 'Nom et index ES sont requis.'
    return
  }
  formError.value = null
  try {
    await createFileSource({
      name: name.trim(),
      es_index: es_index.trim(),
      subfolder: subfolder.trim() || null,
      label: label.trim() || null,
      description: description.trim() || null,
    })
  } catch (e) {
    // La modale reste ouverte : la saisie refusée est encore là, à
    // corriger. La refermer obligerait à tout retaper.
    formError.value = e instanceof Error ? e.message : String(e)
    return
  }
  creating.value = false
  await reload()
}

const { confirm } = useDialogs()</script>

<template>
  <AdminPanel
    id="filesources-panel"
    title="Sources fichiers"
    subtitle="un répertoire indexé = un index Elasticsearch dédié"
    :error="error"
  >
    <DsfrAlert
      v-if="actionError || fieldError"
      id="filesources-erreur"
      type="error"
      small
      :description="actionError || fieldError || ''"
      class="fr-mb-2w"
    />

    <div class="fr-table fr-table--bordered ds-stats__table">
      <table id="filesources-tableau">
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
          <tr v-for="(source, name) in data || {}" :key="name" data-testid="filesources-ligne" :data-source="name">
            <td><code>{{ name }}</code></td>
            <td>{{ source.label || name }}</td>
            <td><code>{{ source.es_index }}</code></td>
            <td>{{ source.folder }}</td>
            <td>{{ source.description || '' }}</td>
            <td>
              <div class="fr-checkbox-group fr-checkbox-group--sm">
                <input
                  :id="`ocr-${name}`"
                  data-testid="filesources-ocr"
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
                data-testid="filesources-libelle"
                @click="edit('file', String(name), 'label', source.label || String(name))"
              />
              <DsfrButton
                size="sm"
                tertiary
                no-outline
                label="Description"
                data-testid="filesources-description"
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
                data-testid="filesources-retirer"
                @click="remove(String(name))"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <DsfrButton
      id="filesources-nouvelle"
      class="fr-mt-2w"
      size="sm"
      secondary
      label="+ Nouvelle source fichiers"
      @click="openForm"
    />

    <p class="fr-hint-text fr-mt-2w">
      OCR (Tesseract, français) : reconnaissance de texte pour les PDF scannés et les images de
      cette source — coûteux en CPU, à réserver aux sources qui en ont besoin. N'affecte que les
      documents indexés après activation, il n'y a pas de réextraction rétroactive.
    </p>

    <!-- Téléportée dans <body>, comme les autres modales : le panneau
         est un <details> que les raccourcis de l'administration
         (chiffres, « tout replier ») referment sans savoir qu'une saisie
         est en cours, et la modale disparaîtrait avec lui. DsfrModal ne
         téléporte pas de lui-même. -->
    <Teleport to="body">
      <!-- `disable-outside-interaction` : un clic à côté ne doit pas
           jeter la saisie. Restent la croix, Échap et « Annuler ». -->
      <DsfrModal
        v-if="creating"
        modal-id="modale-source-fichiers"
        opened
        size="lg"
        disable-outside-interaction
        title="Nouvelle source fichiers"
        @close="creating = false"
      >
        <DsfrAlert
          v-if="formError"
          id="filesources-formulaire-erreur"
          type="error"
          small
          :description="formError"
          class="fr-mb-2w"
        />

        <div class="ds-admin__row">
          <div class="fr-input-group fr-mb-0">
            <label class="fr-label" for="new-file-name">Nom</label>
            <input
              id="new-file-name"
              v-model="form.name"
              class="fr-input fr-input--sm"
              type="text"
              placeholder="ex : finance"
            />
          </div>
          <div class="fr-input-group fr-mb-0">
            <label class="fr-label" for="new-file-index">Index ES</label>
            <input
              id="new-file-index"
              v-model="form.es_index"
              class="fr-input fr-input--sm"
              type="text"
              placeholder="ex : finance_docs"
            />
          </div>
        </div>
        <div class="ds-admin__row fr-mt-1w">
          <div class="fr-input-group fr-mb-0">
            <label class="fr-label" for="new-file-subfolder">Sous-dossier</label>
            <input
              id="new-file-subfolder"
              v-model="form.subfolder"
              class="fr-input fr-input--sm"
              type="text"
              placeholder="défaut : = nom"
            />
          </div>
          <div class="fr-input-group fr-mb-0">
            <label class="fr-label" for="new-file-label">Libellé (optionnel)</label>
            <input
              id="new-file-label"
              v-model="form.label"
              class="fr-input fr-input--sm"
              type="text"
            />
          </div>
        </div>
        <div class="ds-admin__row fr-mt-1w">
          <div class="fr-input-group fr-mb-0">
            <label class="fr-label" for="new-file-description">Description (optionnel)</label>
            <input
              id="new-file-description"
              v-model="form.description"
              class="fr-input fr-input--sm"
              type="text"
            />
          </div>
        </div>

        <p class="fr-hint-text fr-mt-2w">
          Créez d'abord le sous-dossier sur l'hôte (SOURCES_ROOT/&lt;nom&gt;), puis enregistrez-le
          ici — le watcher commence à l'observer sous ~5 s, sans redémarrage. Lancez ensuite
          l'indexation initiale depuis le panneau « Indexation ».
        </p>

        <template #footer>
          <div class="ds-admin__row">
            <DsfrButton id="filesources-ajouter" size="sm" label="Ajouter" @click="add" />
            <DsfrButton
              id="filesources-annuler"
              size="sm"
              secondary
              label="Annuler"
              @click="creating = false"
            />
          </div>
        </template>
      </DsfrModal>
    </Teleport>
  </AdminPanel>
</template>
