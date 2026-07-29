<script setup lang="ts">
/**
 * Panneau « Mes collections » et modale associée. Portage de
 * docsearch-ui/public/js/collections.js.
 *
 * En vanilla, une seule modale servait à deux usages exclusifs
 * (consulter une collection / y ajouter la sélection). Ici, deux modes
 * explicites : `mode` vaut 'view' ou 'add'.
 */
import { ref } from 'vue'
import {
  addDocuments,
  createCollection,
  deleteCollection,
  listCollections,
  removeDocument,
  type Collection,
} from '@/api/collections'
import { getDocument } from '@/api/documents'
import { useSelectionStore } from '@/stores/selection'

const emit = defineEmits<{ detail: [string] }>()

const selection = useSelectionStore()

const open = ref(false)
const collections = ref<Collection[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const mode = ref<'view' | 'add' | null>(null)
const current = ref<Collection | null>(null)
/** Documents de la collection consultée, ou null si inaccessible. */
const documents = ref<{ id: string; title: string | null }[]>([])
const newName = ref('')
const busy = ref(false)

async function refresh() {
  loading.value = true
  error.value = null
  try {
    collections.value = await listCollections()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

async function togglePanel() {
  open.value = !open.value
  if (open.value) await refresh()
}

async function remove(collection: Collection) {
  if (
    !confirm(
      `Supprimer la collection « ${collection.name} » ? Les documents eux-mêmes ne sont pas supprimés.`,
    )
  )
    return
  try {
    collections.value = await deleteCollection(collection.id)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

/**
 * Consulte une collection. Chaque document est relu via /document/{id}
 * — et non lu en masse — pour que la vérification ACL de cet endpoint
 * s'applique ici aussi : un document devenu inaccessible entre-temps
 * n'est jamais exposé, il s'affiche « indisponible ».
 */
async function view(collection: Collection) {
  open.value = false
  mode.value = 'view'
  current.value = collection
  documents.value = []
  busy.value = true
  const results = await Promise.allSettled(collection.doc_ids.map((id) => getDocument(id)))
  documents.value = results.map((r, i) => ({
    id: collection.doc_ids[i],
    title: r.status === 'fulfilled' ? r.value.title || r.value.filename || '(sans nom)' : null,
  }))
  busy.value = false
}

async function removeDoc(docId: string) {
  if (!current.value) return
  try {
    collections.value = await removeDocument(current.value.id, docId)
    const updated = collections.value.find((c) => c.id === current.value?.id)
    if (updated) await view(updated)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

/** Ouvre la modale de choix de collection pour la sélection courante. */
async function openAdd() {
  if (!selection.count) return
  mode.value = 'add'
  newName.value = ''
  await refresh()
}

async function addToCollection(collectionId: string) {
  busy.value = true
  error.value = null
  try {
    await addDocuments(collectionId, selection.ids)
    selection.clear()
    closeModal()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

async function createAndAdd() {
  if (!newName.value.trim()) return
  busy.value = true
  error.value = null
  try {
    const created = await createCollection(newName.value.trim())
    await addDocuments(created.id, selection.ids)
    selection.clear()
    closeModal()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

function closeModal() {
  mode.value = null
  current.value = null
}

function openDetail(docId: string) {
  closeModal()
  emit('detail', docId)
}

defineExpose({ openAdd })
</script>

<template>
  <div class="ds-panel">
    <DsfrButton
      size="sm"
      tertiary
      no-outline
      label="Mes collections"
      :aria-expanded="open"
      @click="togglePanel"
    />

    <div v-if="open" class="ds-panel__body">
      <p v-if="loading" class="fr-hint-text fr-mb-0">Chargement…</p>
      <DsfrAlert v-else-if="error" type="error" small :description="error" />
      <p v-else-if="!collections.length" class="fr-hint-text fr-mb-0">
        Aucune collection pour l'instant.
      </p>

      <div v-for="collection in collections" v-else :key="collection.id" class="ds-panel__item">
        <button class="ds-panel__item-button" @click="view(collection)">
          <span class="ds-panel__item-name">{{ collection.name }}</span>
          <span class="fr-hint-text fr-mb-0">
            {{ collection.doc_ids.length }} document{{ collection.doc_ids.length > 1 ? 's' : '' }}
          </span>
        </button>
        <DsfrButton
          size="sm"
          tertiary
          no-outline
          label="✕"
          :title="`Supprimer la collection ${collection.name}`"
          @click="remove(collection)"
        />
      </div>
    </div>

    <!-- Consultation d'une collection -->
    <DsfrModal
      :opened="mode === 'view'"
      :title="current?.name || 'Collection'"
      @close="closeModal"
    >
      <p v-if="busy">Chargement…</p>
      <p v-else-if="!documents.length" class="fr-hint-text">Collection vide.</p>
      <ul v-else class="ds-collection__docs">
        <li v-for="entry in documents" :key="entry.id">
          <button v-if="entry.title" class="fr-link" @click="openDetail(entry.id)">
            {{ entry.title }}
          </button>
          <span v-else class="fr-hint-text">Document indisponible</span>
          <DsfrButton
            size="sm"
            tertiary
            no-outline
            label="✕"
            title="Retirer de la collection"
            @click="removeDoc(entry.id)"
          />
        </li>
      </ul>
    </DsfrModal>

    <!-- Ajout de la sélection à une collection -->
    <DsfrModal
      :opened="mode === 'add'"
      :title="`Ajouter ${selection.count} document${selection.count > 1 ? 's' : ''} à une collection`"
      @close="closeModal"
    >
      <DsfrAlert v-if="error" type="error" small :description="error" class="fr-mb-2w" />
      <p v-if="!collections.length" class="fr-hint-text">Aucune collection pour l'instant.</p>
      <ul v-else class="ds-collection__picker">
        <li v-for="collection in collections" :key="collection.id">
          <button class="fr-btn fr-btn--tertiary fr-btn--sm" :disabled="busy" @click="addToCollection(collection.id)">
            {{ collection.name }}
            <span class="fr-hint-text fr-ml-1v">{{ collection.doc_ids.length }}</span>
          </button>
        </li>
      </ul>

      <div class="ds-collection__create fr-mt-2w">
        <input
          v-model="newName"
          class="fr-input fr-input--sm"
          type="text"
          aria-label="Nom de la nouvelle collection"
          placeholder="Nouvelle collection…"
          @keydown.enter.prevent="createAndAdd"
        />
        <DsfrButton size="sm" label="Créer" :disabled="busy" @click="createAndAdd" />
      </div>
    </DsfrModal>
  </div>
</template>
