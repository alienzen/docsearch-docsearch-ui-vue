<script setup lang="ts">
/**
 * Thésaurus métier — les sigles et appellations qui désignent la même
 * chose pour tout le monde sauf pour le moteur : « DRH » et « direction
 * des ressources humaines », un ancien et un nouveau nom de service, un
 * nom de code de projet.
 *
 * Chaque modification prend effet À CHAUD : Elasticsearch recharge de
 * lui-même les analyseurs des index concernés, sans réindexation. Le
 * nombre de shards rechargés est affiché — c'est la seule preuve
 * visible que la règle est réellement en vigueur.
 *
 * Le champ d'essai n'est pas un ornement : une règle mal écrite ne
 * produit aucune erreur, seulement une recherche qui ne trouve rien de
 * plus qu'avant. Il montre ce que le moteur comprend RÉELLEMENT.
 */
import { ref } from 'vue'
import {
  addSynonym,
  getSynonyms,
  removeSynonym,
  testSynonyms,
  type RegleSynonyme,
} from '@/api/admin'
import { useStatsPanel } from '@/composables/useStatsPanel'
import { useDialogs } from '@/composables/useDialogs'

const { data, error, refresh } = useStatsPanel(getSynonyms)
const { confirm } = useDialogs()

const nouvelle = ref('')
const actionError = ref<string | null>(null)
const dernierRechargement = ref<number | null>(null)

const essai = ref('')
const jetons = ref<string[] | null>(null)

async function ajouter() {
  actionError.value = null
  try {
    const res = await addSynonym(nouvelle.value)
    dernierRechargement.value = res.shards_recharges
    nouvelle.value = ''
    await refresh()
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : String(e)
  }
}

async function retirer(regle: RegleSynonyme) {
  const ok = await confirm(`Retirer la règle « ${regle.regle} » ?`, {
    title: 'Retirer la règle',
    confirmLabel: 'Retirer',
  })
  if (!ok) return
  actionError.value = null
  try {
    const res = await removeSynonym(regle.id)
    dernierRechargement.value = res.shards_recharges
    await refresh()
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : String(e)
  }
}

async function tester() {
  actionError.value = null
  jetons.value = null
  try {
    jetons.value = (await testSynonyms(essai.value, 'documents')).jetons
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <AdminPanel
    id="synonyms-panel"
    title="Thésaurus"
    subtitle="synonymes de recherche, effectifs immédiatement"
    :error="error"
  >
    <DsfrAlert
      v-if="actionError"
      id="synonymes-erreur"
      type="error"
      small
      :description="actionError"
      class="fr-mb-2w"
    />

    <p class="fr-hint-text">
      Une règle par ligne, termes séparés par une virgule — par exemple
      <code>DRH, direction des ressources humaines</code>. Tous les termes d'une règle
      se trouvent mutuellement : chercher l'un ramène les documents qui portent les
      autres. La recherche entre guillemets, elle, reste littérale.
    </p>

    <div class="fr-mb-2w">
      <DsfrInput
        id="synonymes-nouvelle"
        v-model="nouvelle"
        label="Nouvelle règle"
        label-visible
        hint="Deux termes au minimum, séparés par une virgule."
        @keyup.enter="ajouter"
      />
      <DsfrButton
        id="synonymes-ajouter"
        size="sm"
        label="Ajouter"
        class="fr-mt-1w"
        :disabled="!nouvelle.trim()"
        @click="ajouter"
      />
      <p v-if="dernierRechargement !== null" class="fr-hint-text fr-mt-1w fr-mb-0">
        ✓ Enregistré — {{ dernierRechargement }} shard(s) rechargé(s), sans réindexation.
      </p>
    </div>

    <div class="fr-table fr-table--bordered ds-stats__table">
      <table id="synonymes-tableau">
        <thead>
          <tr>
            <th scope="col">Règle</th>
            <th scope="col"><span class="fr-sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!(data?.regles || []).length">
            <td colspan="2" class="fr-hint-text">
              Aucune règle. Les recherches sans résultat de la page Statistiques sont le
              meilleur endroit où en trouver.
            </td>
          </tr>
          <tr
            v-for="regle in data?.regles || []"
            :key="regle.id"
            data-testid="synonyme-ligne"
            :data-id="regle.id"
          >
            <td><code>{{ regle.regle }}</code></td>
            <td class="ds-admin__actions">
              <DsfrButton
                size="sm"
                secondary
                label="Retirer"
                data-testid="synonyme-retirer"
                @click="retirer(regle)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Sans cet essai, personne ne peut savoir si une règle est prise
         en compte : une règle mal placée ne produit aucune erreur. -->
    <div class="fr-mt-2w">
      <DsfrInput
        id="synonymes-essai"
        v-model="essai"
        label="Essayer une requête"
        label-visible
        hint="Montre ce que le moteur comprend de cette requête, synonymes appliqués."
        @keyup.enter="tester"
      />
      <DsfrButton
        id="synonymes-tester"
        size="sm"
        secondary
        label="Analyser"
        class="fr-mt-1w"
        :disabled="!essai.trim()"
        @click="tester"
      />
      <ul v-if="jetons" id="synonymes-jetons" class="fr-tags-group fr-mt-1w">
        <li v-for="jeton in jetons" :key="jeton">
          <span class="fr-tag fr-tag--sm">{{ jeton }}</span>
        </li>
        <li v-if="!jetons.length" class="fr-hint-text">
          Aucun terme retenu (mot vide, ou requête réduite à de la ponctuation).
        </li>
      </ul>
    </div>
  </AdminPanel>
</template>
