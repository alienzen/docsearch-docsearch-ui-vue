<script setup lang="ts">
/**
 * Sources web : un site crawlé par Elastic Open Web Crawler écrit dans
 * un index de crawl intermédiaire, que le worker web relit et
 * transforme vers l'index final au schéma DocSearch.
 *
 * Ce panneau ne gère QUE ce registre « index de crawl → index final ».
 * Le crawl lui-même est configuré à part (docsearch-infra/crawlers/*.yml)
 * et tourne selon son propre planning.
 */
import { ref } from 'vue'
import {
  createWebSource,
  deleteWebSource,
  getWebSources,
  setWebSourcePaused,
} from '@/api/admin'
import { useStatsPanel } from '@/composables/useStatsPanel'
import { useSourceField } from '@/composables/useSourceField'
import { useDialogs } from '@/composables/useDialogs'

type WebSource = {
  label: string
  crawl_index: string
  es_index: string
  acl_public?: boolean
  poll_interval_seconds: number
  description?: string
  paused?: boolean
}

const { data, error, refresh } = useStatsPanel(
  () => getWebSources() as Promise<Record<string, WebSource>>,
)
const { error: fieldError, edit } = useSourceField(refresh)
const actionError = ref<string | null>(null)
/**
 * Le refus de la création a son propre bandeau, DANS la modale : celui
 * du panneau (`actionError`, partagé avec le retrait et la suspension)
 * s'afficherait derrière elle, donc nulle part.
 */
const formError = ref<string | null>(null)
/** La modale de création est ouverte. */
const creating = ref(false)

function blankForm() {
  return {
    name: '',
    label: '',
    crawl_index: '',
    es_index: '',
    acl_public: true,
    poll_interval_seconds: 3600,
    description: '',
  }
}

const form = ref(blankForm())

async function run(action: () => Promise<unknown>) {
  actionError.value = null
  try {
    await action()
    await refresh()
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : String(e)
  }
}

async function togglePaused(name: string, source: WebSource, active: boolean) {
  const before = source.paused
  source.paused = !active
  actionError.value = null
  try {
    await setWebSourcePaused(name, !active)
  } catch (e) {
    source.paused = before
    actionError.value = e instanceof Error ? e.message : String(e)
  }
}

async function remove(name: string) {
  const ok = await confirm(
    `Retirer la source web « ${name} » ? Son index Elasticsearch et ses documents ne seront PAS supprimés.`,
    { title: 'Retirer la source web', confirmLabel: 'Retirer' },
  )
  if (!ok) return
  return run(() => deleteWebSource(name))
}

/** Ouvre la modale sur un formulaire vierge. */
function openForm() {
  form.value = blankForm()
  formError.value = null
  actionError.value = null
  creating.value = true
}

async function add() {
  const f = form.value
  if (!f.name.trim() || !f.crawl_index.trim() || !f.es_index.trim()) {
    formError.value = 'Nom, index de crawl et index ES final sont requis.'
    return
  }
  formError.value = null
  try {
    await createWebSource({
      name: f.name.trim(),
      crawl_index: f.crawl_index.trim(),
      es_index: f.es_index.trim(),
      acl_public: f.acl_public,
      poll_interval_seconds: Number(f.poll_interval_seconds) || 3600,
      label: f.label.trim() || null,
      description: f.description.trim() || null,
    })
  } catch (e) {
    // La modale reste ouverte : la saisie refusée est encore là, à
    // corriger. La refermer obligerait à tout retaper.
    formError.value = e instanceof Error ? e.message : String(e)
    return
  }
  creating.value = false
  await refresh()
}

const { confirm } = useDialogs()</script>

<template>
  <AdminPanel
    id="websources-panel"
    title="Sources web"
    subtitle="sites crawlés par Elastic Open Web Crawler"
    :error="error"
  >
    <DsfrAlert
      v-if="actionError || fieldError"
      id="websources-erreur"
      type="error"
      small
      :description="actionError || fieldError || ''"
      class="fr-mb-2w"
    />

    <div class="fr-table fr-table--bordered ds-stats__table">
      <table id="websources-tableau">
        <thead>
          <tr>
            <th scope="col">Nom</th>
            <th scope="col">Libellé</th>
            <th scope="col">Crawl → Index ES</th>
            <th scope="col">ACL</th>
            <th scope="col">Intervalle</th>
            <th scope="col">Description</th>
            <th scope="col">Crawl</th>
            <th scope="col"><span class="fr-sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!Object.keys(data || {}).length">
            <td colspan="8" class="fr-hint-text">Aucune source web.</td>
          </tr>
          <tr v-for="(source, name) in data || {}" :key="name" data-testid="websources-ligne" :data-source="name">
            <td><code>{{ name }}</code></td>
            <td class="ds-admin__actions">
              {{ source.label }}
              <DsfrButton
                size="sm"
                tertiary
                no-outline
                label="Modifier"
                data-testid="websources-libelle"
                @click="edit('web', String(name), 'label', source.label)"
              />
            </td>
            <td><code>{{ source.crawl_index }}</code> → <code>{{ source.es_index }}</code></td>
            <td>{{ source.acl_public ? 'public' : 'privé' }}</td>
            <td>{{ source.poll_interval_seconds }} s</td>
            <td class="ds-admin__actions">
              {{ source.description || '' }}
              <DsfrButton
                size="sm"
                tertiary
                no-outline
                label="Modifier"
                data-testid="websources-description"
                @click="edit('web', String(name), 'description', source.description || '')"
              />
            </td>
            <td>
              <div class="fr-checkbox-group fr-checkbox-group--sm">
                <input
                  :id="`web-active-${name}`"
                  data-testid="websources-actif"
                  type="checkbox"
                  :checked="!source.paused"
                  @change="
                    togglePaused(String(name), source, ($event.target as HTMLInputElement).checked)
                  "
                />
                <label class="fr-label" :for="`web-active-${name}`">
                  {{ source.paused ? 'suspendu' : 'actif' }}
                </label>
              </div>
            </td>
            <td>
              <DsfrButton
                size="sm"
                tertiary
                label="Retirer"
                data-testid="websources-retirer"
                @click="remove(String(name))"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="fr-hint-text fr-mt-2w">
      « Suspendre » arrête la RÉPERCUSSION vers DocSearch : le worker web cesse de relire l'index de
      crawl. Le conteneur Elastic Open Web Crawler, lui, n'est pas piloté depuis cette interface et
      poursuit son cycle indépendamment.
    </p>

    <DsfrButton
      id="websources-nouvelle"
      class="fr-mt-2w"
      size="sm"
      secondary
      label="+ Nouvelle source web"
      @click="openForm"
    />

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
        modal-id="modale-source-web"
        opened
        size="lg"
        disable-outside-interaction
        title="Nouvelle source web"
        @close="creating = false"
      >
        <DsfrAlert
          v-if="formError"
          id="websources-formulaire-erreur"
          type="error"
          small
          :description="formError"
          class="fr-mb-2w"
        />

        <div class="ds-admin__row">
          <div class="fr-input-group fr-mb-0">
            <label class="fr-label" for="new-web-name">Nom</label>
            <input
              id="new-web-name"
              v-model="form.name"
              class="fr-input fr-input--sm"
              type="text"
              placeholder="ex : cc_decisions"
            />
          </div>
          <div class="fr-input-group fr-mb-0">
            <label class="fr-label" for="new-web-label">Libellé (optionnel)</label>
            <input
              id="new-web-label"
              v-model="form.label"
              class="fr-input fr-input--sm"
              type="text"
            />
          </div>
        </div>
        <div class="ds-admin__row fr-mt-1w">
          <div class="fr-input-group fr-mb-0">
            <label class="fr-label" for="new-web-crawlindex">Index de crawl</label>
            <input
              id="new-web-crawlindex"
              v-model="form.crawl_index"
              class="fr-input fr-input--sm"
              type="text"
              placeholder="output_index du crawler"
            />
          </div>
          <div class="fr-input-group fr-mb-0">
            <label class="fr-label" for="new-web-esindex">Index ES final</label>
            <input
              id="new-web-esindex"
              v-model="form.es_index"
              class="fr-input fr-input--sm"
              type="text"
              placeholder="ex : cc_decisions"
            />
          </div>
        </div>
        <div class="ds-admin__row fr-mt-1w">
          <div class="fr-checkbox-group fr-mb-0">
            <input id="new-web-public" v-model="form.acl_public" type="checkbox" />
            <label class="fr-label" for="new-web-public">
              Contenu public (sans authentification)
            </label>
          </div>
          <div class="fr-input-group fr-mb-0 ds-admin__narrow">
            <label class="fr-label" for="new-web-interval">Intervalle (s)</label>
            <input
              id="new-web-interval"
              v-model="form.poll_interval_seconds"
              class="fr-input fr-input--sm"
              type="number"
              min="30"
            />
          </div>
        </div>
        <div class="ds-admin__row fr-mt-1w">
          <div class="fr-input-group fr-mb-0">
            <label class="fr-label" for="new-web-description">Description (optionnel)</label>
            <input
              id="new-web-description"
              v-model="form.description"
              class="fr-input fr-input--sm"
              type="text"
            />
          </div>
        </div>

        <p class="fr-hint-text fr-mt-2w">
          L'index de crawl doit correspondre au <code>output_index</code> déclaré dans la
          configuration du crawler — jamais le même que l'index ES final, qui reçoit le contenu
          transformé au schéma DocSearch.
        </p>

        <template #footer>
          <div class="ds-admin__row">
            <DsfrButton id="websources-ajouter" size="sm" label="Ajouter" @click="add" />
            <DsfrButton
              id="websources-annuler"
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
