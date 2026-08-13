<script setup lang="ts">
/**
 * Panneau « Mes collections » et modale associée. Portage de
 * docsearch-ui/public/js/collections.js.
 *
 * En vanilla, une seule modale servait à deux usages exclusifs
 * (consulter une collection / y ajouter la sélection). Ici, deux modes
 * explicites : `mode` vaut 'view' ou 'add'.
 */
import { computed, onMounted, ref } from 'vue'
import {
  addDocuments,
  createCollection,
  deleteCollection,
  listCollections,
  removeDocument,
  type Collection,
} from '@/api/collections'
import { getDocument } from '@/api/documents'
import { duplicateCollection, shareCollection } from '@/api/collections'
import { useSelectionStore } from '@/stores/selection'
import { useUiConfigStore } from '@/stores/uiConfig'
import { useDialogs } from '@/composables/useDialogs'

const emit = defineEmits<{ detail: [string] }>()

const selection = useSelectionStore()
const uiConfig = useUiConfigStore()
const { confirm, prompt } = useDialogs()

const collections = ref<Collection[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const mode = ref<'view' | 'add' | null>(null)
const current = ref<Collection | null>(null)
/** Documents de la collection consultée, ou null si inaccessible. */
const documents = ref<{ id: string; title: string | null }[]>([])

/**
 * Documents de la collection que CE lecteur n'a pas le droit de voir (ou
 * qui ont été supprimés depuis). Partager une collection donne la
 * référence, pas le droit : deux personnes n'y voient donc pas forcément
 * le même nombre de documents. On le DIT — masquer l'écart ferait croire
 * au propriétaire qu'il a partagé dix documents quand le destinataire en
 * voit sept, sans que personne s'en aperçoive.
 */
const inaccessibles = computed(() => documents.value.filter((d) => d.title === null).length)
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

const menu = ref<{ close: () => void } | null>(null)

// Chargé au montage : l'entrée de navigation est masquée quand il n'y a
// aucune collection, ce qui suppose d'en connaître le nombre avant tout
// clic. La MODALE d'ajout reste, elle, toujours disponible — c'est par
// elle qu'on crée sa première collection.
onMounted(refresh)

async function remove(collection: Collection) {
  const ok = await confirm(
    `Supprimer la collection « ${collection.name} » ? Les documents eux-mêmes ne sont pas supprimés.`,
    { title: 'Supprimer la collection', confirmLabel: 'Supprimer' },
  )
  if (!ok) return
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
  menu.value?.close()
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

/**
 * On ne propose que les groupes DONT L'UTILISATEUR EST MEMBRE : l'API
 * refuse les autres, et lui laisser désigner un groupe quelconque de
 * l'annuaire reviendrait à lui offrir de s'adresser à toute
 * l'organisation.
 */
async function partager(collection: Collection) {
  const mes = uiConfig.currentUser.groups
  if (!mes.length) {
    error.value = "Vous n'appartenez à aucun groupe : il n'y a personne avec qui partager."
    return
  }
  const saisie = await prompt(
    `Partager « ${collection.name} » avec (séparés par une virgule) — vos groupes : ${mes.join(', ')}`,
    collection.shared_with.join(', '),
    { title: 'Partager la collection' },
  )
  if (saisie === null) return
  error.value = null
  try {
    collections.value = await shareCollection(
      collection.id,
      saisie.split(',').map((g) => g.trim()).filter(Boolean),
    )
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

/** Porte de sortie du destinataire : il ne modifie pas, il recopie. */
async function dupliquer(collection: Collection) {
  error.value = null
  try {
    collections.value = await duplicateCollection(collection.id)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
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
    // Le compteur de documents affiché dans le menu doit suivre.
    await refresh()
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
    // Indispensable pour la PREMIÈRE collection : l'entrée « Mes
    // collections » de la navigation est conditionnée à une liste non
    // vide, laquelle n'était chargée qu'au montage de la page. Sans ce
    // rafraîchissement, elle n'apparaissait qu'au rechargement suivant —
    // même mécanisme que `reload()` de SavedSearchesPanel après
    // l'enregistrement d'une recherche.
    await refresh()
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
  <NavMenuItem
    v-if="collections.length"
    id="collections"
    ref="menu"
    label="Mes collections"
    @open="refresh"
  >
    <li v-if="loading" class="ds-menu__message">Chargement…</li>
    <li v-else-if="error" class="ds-menu__message">
      <DsfrAlert type="error" small :description="error" />
    </li>

    <li
      v-for="collection in collections"
      v-else
      :key="collection.id"
      class="ds-menu__entry"
      data-testid="collection"
      :data-id="collection.id"
    >
      <button
        class="fr-nav__link ds-menu__button"
        data-testid="collection-ouvrir"
        @click="view(collection)"
      >
        <span class="ds-menu__name">{{ collection.name }}</span>
        <span class="fr-hint-text fr-mb-0">
          {{ collection.doc_ids.length }} document{{ collection.doc_ids.length > 1 ? 's' : '' }}
          <!-- D'où vient cette collection : sans ça, une collection
               reçue surgit de nulle part dans le menu. -->
          <template v-if="!collection.owned"> · partagée par {{ collection.owner }}</template>
          <template v-else-if="collection.shared_with.length">
            · partagée avec {{ collection.shared_with.join(', ') }}
          </template>
        </span>
      </button>
      <div class="fr-px-2w">
        <!-- Écrire reste au propriétaire : le destinataire duplique. -->
        <template v-if="collection.owned">
          <DsfrButton
            v-if="uiConfig.config.collections_shared_enabled"
            size="sm"
            tertiary
            no-outline
            label="Partager"
            data-testid="collection-partager"
            :title="`Partager la collection ${collection.name} avec un groupe`"
            @click="partager(collection)"
          />
          <DsfrButton
            size="sm"
            tertiary
            no-outline
            label="Supprimer"
            data-testid="collection-supprimer"
            :title="`Supprimer la collection ${collection.name}`"
            @click="remove(collection)"
          />
        </template>
        <DsfrButton
          v-else
          size="sm"
          tertiary
          no-outline
          label="Dupliquer"
          data-testid="collection-dupliquer"
          :title="`Recopier ${collection.name} dans mes collections`"
          @click="dupliquer(collection)"
        />
      </div>
    </li>
  </NavMenuItem>

  <!-- Les modales sont téléportées hors du menu : à l'intérieur, elles
       hériteraient du `visibility: hidden` que le DSFR applique à un
       `.fr-collapse` replié, et resteraient invisibles une fois le menu
       refermé. DsfrModal ne téléporte pas de lui-même. -->
  <Teleport to="body">
    <DsfrModal
      modal-id="modale-collection"
      :opened="mode === 'view'"
      :title="current?.name || 'Collection'"
      @close="closeModal"
    >
      <p v-if="busy">Chargement…</p>
      <p v-else-if="!documents.length" class="fr-hint-text">Collection vide.</p>
      <!-- Dit plutôt que masqué : partager donne la référence, pas le
           droit, et l'écart entre ce que chacun voit est une information,
           pas un détail à cacher. -->
      <DsfrAlert
        v-if="!busy && inaccessibles"
        id="collection-inaccessibles"
        type="info"
        small
        :description="`${inaccessibles} document${inaccessibles > 1 ? 's ne vous sont pas accessibles' : ' ne vous est pas accessible'} (droits insuffisants ou document supprimé).`"
        class="fr-mb-2w"
      />
      <ul v-else class="ds-collection__docs">
        <li v-for="entry in documents" :key="entry.id" data-testid="collection-document" :data-id="entry.id">
          <button v-if="entry.title" class="fr-link" @click="openDetail(entry.id)">
            {{ entry.title }}
          </button>
          <span v-else class="fr-hint-text">Document indisponible</span>
          <DsfrButton
            v-if="current?.owned"
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

    <DsfrModal
      modal-id="modale-collection-ajout"
      :opened="mode === 'add'"
      :title="`Ajouter ${selection.count} document${selection.count > 1 ? 's' : ''} à une collection`"
      @close="closeModal"
    >
      <DsfrAlert v-if="error" type="error" small :description="error" class="fr-mb-2w" />
      <p v-if="!collections.length" class="fr-hint-text">Aucune collection pour l'instant.</p>
      <ul v-else class="ds-collection__picker">
        <li v-for="collection in collections" :key="collection.id">
          <button
            class="fr-btn fr-btn--tertiary fr-btn--sm"
            :disabled="busy"
            @click="addToCollection(collection.id)"
          >
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
  </Teleport>
</template>
