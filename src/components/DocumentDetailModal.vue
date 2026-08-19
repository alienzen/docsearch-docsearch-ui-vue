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
import { parseHighlights, type HighlightSegment } from '@/utils/highlight'
import { lienExterne, urlAbregee } from '@/utils/paths'

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
 * Extrait du document, rendu comme sur la carte de résultat : le
 * surlignage d'Elasticsearch est le seul balisage conservé, tout le
 * reste passe par Vue, donc échappé (voir parseHighlight).
 *
 * Il vient du RÉSULTAT déjà en mémoire, pas de la fiche : /document/{id}
 * ne renvoie aucun surlignage, et il ne le peut pas — sans requête,
 * Elasticsearch n'a rien à surligner. Les documents mis en avant sont
 * cherchés eux aussi : ils sortent de `results` pour aller dans
 * `pinnedResults`, et la fiche ouverte depuis l'un d'eux serait sinon la
 * seule sans extrait.
 */
const surlignage = computed(() => {
  const resultat = [...store.pinnedResults, ...store.results].find(
    (r) => r.id === props.documentId,
  )
  return parseHighlights(resultat?.highlight || [])
})

/** Longueur du repli sur le contenu, en caractères. */
const EXTRAIT_MAX = 500

/**
 * Repli : le début du texte indexé. La fiche s'ouvre aussi hors
 * recherche — depuis une collection, depuis l'état d'accueil — et elle
 * ne montrait alors rien du contenu du document.
 */
const debutContenu = computed(() => {
  // Le texte d'un PDF arrive criblé de sauts de ligne et d'espaces de
  // mise en page : sans normalisation, l'extrait s'affiche en escalier.
  const contenu = (doc.value?.content || '').replace(/\s+/g, ' ').trim()
  if (contenu.length <= EXTRAIT_MAX) return contenu
  // Coupe sur la dernière espace pour ne pas trancher un mot en deux.
  const coupe = contenu.slice(0, EXTRAIT_MAX)
  const espace = coupe.lastIndexOf(' ')
  return `${espace > 0 ? coupe.slice(0, espace) : coupe}…`
})

const extrait = computed<HighlightSegment[]>(() => {
  if (surlignage.value.length) return surlignage.value
  return debutContenu.value ? [{ text: debutContenu.value, marked: false }] : []
})

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
 *
 * La condition sur le TYPE de source est arrivée le 2026-08-17, en même
 * temps que le lien externe ci-dessous. La carte de résultat l'avait reçue
 * la veille (voir `previewable` dans ResultCard.vue) ; la fiche détail
 * était restée en arrière, et proposait donc encore « Voir l'aperçu » sur
 * une page web ou un document de module, où il n'y a aucun fichier à
 * convertir. Le lien menait à une erreur de conversion.
 */
const previewable = computed(
  () => !!doc.value?.filepath && uiConfig.sourceType(doc.value?.source || '') === 'file',
)

/** Adresse ouvrable, quand le `filepath` en est une. */
const lien = computed(() => lienExterne(doc.value?.filepath))

/**
 * Texte du lien, abrégé comme sur la carte de résultat — le `href`,
 * l'infobulle et la copie gardent l'adresse entière.
 *
 * La ligne n'a ici AUCUNE ellipse CSS, contrairement à la carte : une
 * adresse longue, qui n'offre aucune espace où couper, poussait la
 * colonne de valeurs et débordait de la fenêtre modale.
 */
const lienTexte = computed(() => (lien.value ? urlAbregee(lien.value) : ''))

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

      <!-- Plus grande que sur la carte : la fiche a la place, et c'est
           le seul endroit où l'on regarde un document pour lui-même. -->
      <DocumentVignette :url="doc.image" format="detail" />

      <!-- Sous le titre et la vignette, AVANT les champs : c'est le texte
           du document, et le placer après le reléguerait derrière
           l'enfilade de colonnes d'une source SQL. -->
      <p v-if="extrait.length" id="document-extrait" class="ds-detail__extrait fr-text--sm">
        <template v-for="(segment, i) in extrait" :key="i">
          <mark v-if="segment.marked">{{ segment.text }}</mark>
          <template v-else>{{ segment.text }}</template>
        </template>
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
        <!-- Une adresse plutôt qu'un dossier : sources web et documents de
             modules rangent une URL dans `filepath`, et la ligne
             « Dossier » affichait alors un tiret suivi des boutons de
             copie, sans jamais permettre d'ouvrir la page. -->
        <li v-if="lien">
          <span>Adresse</span>
          <span>
            <a
              class="fr-link fr-link--sm"
              data-testid="detail-lien"
              :href="lien"
              :title="`${doc.filepath} — nouvelle fenêtre`"
              target="_blank"
              rel="noopener"
              >{{ lienTexte }}</a
            >
            <!-- `lien` vaut l'adresse, donc le chemin existe — mais le
                 typage ne déduit pas l'un de l'autre à travers le `v-if`.
                 On lui passe `lien`, qui est la même valeur nettoyée. -->
            <CopyPathButtons :filepath="lien" />
          </span>
        </li>
        <li v-else-if="doc.folder || doc.filepath">
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
