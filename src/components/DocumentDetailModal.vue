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
import { extraFields } from '@/utils/extraFields'

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

/**
 * Champs propres à la source (colonnes d'une source SQL), avec les
 * libellés de son mapping. Même mécanisme que la carte de résultat :
 * une fiche d'agent doit montrer bureau, fonction et téléphone, pas une
 * enfilade de « — » sur des métadonnées de fichier qu'elle n'a pas.
 *
 * Et même réserve d'administration : l'empreinte de contenu ne sort
 * qu'en administration (voir RESERVES_ADMIN dans extraFields). Sans ce
 * drapeau, la fiche l'aurait montrée à tous alors que la carte la
 * masque — le même champ, deux écrans, deux réponses.
 */
const extras = computed(() =>
  extraFields(doc.value || {}, uiConfig.sourceCardFields(doc.value?.source || ''), {
    admin: uiConfig.isAdmin,
  }),
)

/**
 * Section « Droits d'accès » : toujours visible d'un administrateur,
 * visible des autres seulement si la bascule le permet.
 *
 * C'est un choix d'AFFICHAGE, pas un contrôle d'accès : la donnée reste
 * dans la réponse /document/{id}. Masquer une section d'écran ne protège
 * rien — le vrai filtrage est celui des résultats, indépendant de cette
 * bascule.
 */
const showAcl = computed(() => uiConfig.isAdmin || uiConfig.config.acl_visible_enabled)

/**
 * L'aperçu convertit un FICHIER : sans chemin, il n'y a rien à
 * convertir. Une ligne de source SQL n'en a pas — le lien menait donc à
 * une erreur.
 */
const previewable = computed(() => !!doc.value?.filepath)

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
    modal-id="modale-document"
    :opened="opened"
    title="Détail du document"
    size="lg"
    @close="emit('close')"
  >
    <p v-if="loading">Chargement…</p>
    <DsfrAlert
      v-else-if="error"
      id="document-erreur"
      type="error"
      :description="`Impossible de charger ce document : ${error}`"
    />

    <template v-else-if="doc">
      <div id="document-entete" class="ds-detail__head">
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
      <p v-else-if="previewable">
        <a
          id="document-apercu"
          class="fr-link fr-icon-eye-line fr-link--icon-left"
          :href="`/api/preview/${documentId}`"
          target="_blank"
        >
          Voir l'aperçu
        </a>
      </p>

      <ul id="document-champs" class="ds-detail__rows fr-text--sm">
        <li v-if="doc.author"><span>Auteur</span><span>{{ doc.author }}</span></li>
        <!-- Masquée s'il n'y a ni mot-clé ni possibilité d'en ajouter :
             une ligne SQL n'en a pas, et affichait « — ». -->
        <li v-if="doc.keywords?.length || canEditKeywords">
          <span>Mots-clés</span>
          <span class="ds-detail__keywords">
            <template v-if="doc.keywords?.length">
              <span
                v-for="keyword in doc.keywords"
                :key="keyword"
                class="fr-tag fr-tag--sm"
                data-testid="document-mot-cle"
                :data-mot-cle="keyword"
              >
                {{ keyword }}
                <button
                  v-if="canEditKeywords"
                  class="ds-detail__keyword-remove"
                  data-testid="document-mot-cle-retirer"
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
        <li v-if="doc.date_created">
          <span>Créé le</span><span>{{ doc.date_created.slice(0, 10) }}</span>
        </li>
        <li v-if="doc.date_modified">
          <span>Modifié le</span><span>{{ doc.date_modified.slice(0, 10) }}</span>
        </li>
        <li v-if="doc.folder || doc.filepath">
          <span>Dossier</span>
          <span>
            {{ doc.folder || '—' }}
            <CopyPathButtons v-if="doc.filepath" :filepath="doc.filepath" />
          </span>
        </li>
        <li v-if="doc.size"><span>Taille</span><span>{{ fmtSize(doc.size) }}</span></li>

        <!-- Colonnes de la source, sous les libellés de son mapping. -->
        <li v-for="champ in extras" :key="champ.key">
          <span>{{ champ.label }}</span><span>{{ champ.value }}</span>
        </li>
        <li v-if="archive">
          <span>Chemin dans l'archive</span><span><code>{{ archive.inner }}</code></span>
        </li>
      </ul>

      <div v-if="canEditKeywords" class="ds-detail__keyword-add fr-mt-1w">
        <input
          id="document-mot-cle-nouveau"
          v-model="newKeyword"
          class="fr-input fr-input--sm"
          type="text"
          aria-label="Ajouter un ou plusieurs mots-clés"
          placeholder="Ajouter un ou plusieurs mots-clés (séparés par ;)…"
          @keydown.enter.prevent="onAddKeyword"
        />
        <DsfrButton id="document-mot-cle-ajouter" size="sm" secondary label="Ajouter" @click="onAddKeyword" />
      </div>
      <DsfrAlert
        v-if="keywordError"
        id="document-erreur-mot-cle"
        type="error"
        small
        :description="keywordError"
        class="fr-mt-1w"
      />

      <template v-if="showAcl">
        <h3 id="document-droits-titre" class="fr-h6 fr-mt-3w">Droits d'accès</h3>
        <ul id="document-droits" class="fr-tags-group">
          <li v-if="doc.acl?.owner">
            <span class="fr-tag fr-tag--sm">Propriétaire : {{ doc.acl.owner }}</span>
          </li>
          <li v-for="group in doc.acl?.groups || []" :key="group">
            <span class="fr-tag fr-tag--sm">Groupe : {{ group }}</span>
          </li>
          <li v-if="doc.acl?.public"><span class="fr-tag fr-tag--sm">Public</span></li>
        </ul>
      </template>
    </template>
  </DsfrModal>
</template>
