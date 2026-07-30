<script setup lang="ts">
/**
 * Fiche détail d'un document. Portage de
 * docsearch-ui/public/js/detail.js (openDetail/renderDetail).
 */
import { computed, ref, watch } from 'vue'
import { addKeywords, getDocument, removeKeyword, type DocumentDetail } from '@/api/documents'
import { trackClick } from '@/api/engagement'
import { extLabel, fmtSize } from '@/utils/format'
import { useSearchStore } from '@/stores/search'
import { useUiConfigStore } from '@/stores/uiConfig'

const props = defineProps<{ documentId: string | null }>()
const emit = defineEmits<{ close: [] }>()

const store = useSearchStore()
const uiConfig = useUiConfigStore()

const doc = ref<DocumentDetail | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const newKeyword = ref('')
const keywordError = ref<string | null>(null)

const opened = computed(() => props.documentId !== null)

async function load(id: string, withSpinner: boolean) {
  // Après ajout/retrait d'un mot-clé, on recharge SANS repasser par
  // « Chargement… » : la requête est quasi instantanée et le vidage de
  // la fiche se voyait comme un clignotement.
  if (withSpinner) {
    loading.value = true
    doc.value = null
  }
  error.value = null
  try {
    doc.value = await getDocument(id)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

watch(
  () => props.documentId,
  (id) => {
    newKeyword.value = ''
    keywordError.value = null
    if (!id) return
    // Rattache le clic à la recherche qui a produit le résultat.
    trackClick(store.searchId, id, store.resultIds.indexOf(id))
    load(id, true)
  },
  { immediate: true },
)

/** Un membre d'archive a un chemin « archive.zip::interne/f.txt ». */
const archive = computed(() => {
  const filepath = doc.value?.filepath || ''
  if (!filepath.includes('::')) return null
  const [outer, inner] = filepath.split('::')
  return { name: outer.split('/').pop(), inner }
})

/**
 * Édition des mots-clés réservée aux documents de type fichier (pas
 * email/web/SQL) et soumise à la bascule d'administration.
 */
const canEditKeywords = computed(
  () =>
    uiConfig.config.custom_keywords_enabled &&
    (doc.value?.type === 'document' || doc.value?.type === 'archive_member'),
)

async function onAddKeyword() {
  if (!props.documentId || !newKeyword.value.trim()) return
  keywordError.value = null
  try {
    await addKeywords(props.documentId, newKeyword.value)
    newKeyword.value = ''
    await load(props.documentId, false)
  } catch (e) {
    keywordError.value = e instanceof Error ? e.message : String(e)
  }
}

async function onRemoveKeyword(keyword: string) {
  if (!props.documentId) return
  keywordError.value = null
  try {
    await removeKeyword(props.documentId, keyword)
    await load(props.documentId, false)
  } catch (e) {
    keywordError.value = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <DsfrModal
    :opened="opened"
    title="Détail du document"
    size="lg"
    @close="emit('close')"
  >
    <p v-if="loading">Chargement…</p>
    <DsfrAlert v-else-if="error" type="error" :description="`Impossible de charger ce document : ${error}`" />

    <template v-else-if="doc">
      <div class="ds-detail__head">
        <span class="fr-badge">{{ extLabel(doc.extension) }}</span>
        <div>
          <p class="fr-text--lead fr-mb-0">{{ doc.title || doc.filename }}</p>
          <p v-if="archive" class="fr-hint-text fr-mb-0">
            Extrait de l'archive {{ archive.name }}
          </p>
        </div>
      </div>

      <!-- Un membre d'archive n'existe que temporairement pendant
           l'indexation : il n'y a aucun fichier à prévisualiser. -->
      <DsfrAlert
        v-if="archive"
        type="info"
        small
        description="Aperçu non disponible : ce document n'existe que temporairement pendant l'indexation de l'archive."
        class="fr-mb-2w"
      />
      <p v-else>
        <a class="fr-link fr-icon-eye-line fr-link--icon-left" :href="`/api/preview/${documentId}`" target="_blank">
          Voir l'aperçu
        </a>
      </p>

      <ul class="ds-detail__rows fr-text--sm">
        <li><span>Auteur</span><span>{{ doc.author || '—' }}</span></li>
        <li>
          <span>Mots-clés</span>
          <span class="ds-detail__keywords">
            <template v-if="doc.keywords?.length">
              <span v-for="keyword in doc.keywords" :key="keyword" class="fr-tag fr-tag--sm">
                {{ keyword }}
                <button
                  v-if="canEditKeywords"
                  class="ds-detail__keyword-remove"
                  :aria-label="`Retirer le mot-clé ${keyword}`"
                  @click="onRemoveKeyword(keyword)"
                >
                  ✕
                </button>
              </span>
            </template>
            <template v-else-if="!canEditKeywords">—</template>
          </span>
        </li>
        <li><span>Créé le</span><span>{{ doc.date_created ? doc.date_created.slice(0, 10) : '—' }}</span></li>
        <li><span>Modifié le</span><span>{{ doc.date_modified ? doc.date_modified.slice(0, 10) : '—' }}</span></li>
        <li>
          <span>Dossier</span>
          <span>
            {{ doc.folder || '—' }}
            <CopyPathButtons v-if="doc.filepath" :filepath="doc.filepath" />
          </span>
        </li>
        <li><span>Taille</span><span>{{ fmtSize(doc.size) }}</span></li>
        <li v-if="archive">
          <span>Chemin dans l'archive</span><span><code>{{ archive.inner }}</code></span>
        </li>
      </ul>

      <div v-if="canEditKeywords" class="ds-detail__keyword-add fr-mt-1w">
        <input
          v-model="newKeyword"
          class="fr-input fr-input--sm"
          type="text"
          aria-label="Ajouter un ou plusieurs mots-clés"
          placeholder="Ajouter un ou plusieurs mots-clés (séparés par ;)…"
          @keydown.enter.prevent="onAddKeyword"
        />
        <DsfrButton size="sm" secondary label="Ajouter" @click="onAddKeyword" />
      </div>
      <DsfrAlert v-if="keywordError" type="error" small :description="keywordError" class="fr-mt-1w" />

      <h3 class="fr-h6 fr-mt-3w">Droits d'accès</h3>
      <ul class="fr-tags-group">
        <li v-if="doc.acl?.owner"><span class="fr-tag fr-tag--sm">Propriétaire : {{ doc.acl.owner }}</span></li>
        <li v-for="group in doc.acl?.groups || []" :key="group">
          <span class="fr-tag fr-tag--sm">Groupe : {{ group }}</span>
        </li>
        <li v-if="doc.acl?.public"><span class="fr-tag fr-tag--sm">Public</span></li>
      </ul>
    </template>
  </DsfrModal>
</template>
