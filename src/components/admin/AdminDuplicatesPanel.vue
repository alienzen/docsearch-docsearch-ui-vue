<script setup lang="ts">
/**
 * Documents indexés en plusieurs exemplaires.
 *
 * Un partage bureautique accumule les copies — « rapport.pdf »,
 * « rapport - Copie.pdf », le même fichier dans le dossier de chacun.
 * Rien ne le mesurait avant l'empreinte de contenu (`content_sha256`).
 *
 * ⚠️ Le rapport ne couvre que les documents PORTANT une empreinte : les
 * sources SQL et web n'en ont pas (pas de fichier), et les documents
 * indexés avant l'ajout du champ non plus tant que
 * `./manage.sh backfill-hashes` n'a pas tourné. Le panneau le dit
 * plutôt que d'annoncer « aucun doublon » sur un corpus non mesuré.
 *
 * Servi depuis un cache quotidien : le recalcul parcourt l'index, donc
 * il se demande explicitement.
 */
import { computed, ref } from 'vue'
import { getDuplicates, type RapportDoublons } from '@/api/admin'
import { fmtSize } from '@/utils/format'

const props = defineProps<{ sources: { name: string; label?: string }[] }>()

const source = ref('documents')
const data = ref<RapportDoublons | null>(null)
const error = ref<string | null>(null)
const chargement = ref(false)

const options = computed(() =>
  props.sources.map((s) => ({ value: s.name, text: s.label || s.name })),
)

async function charger(rafraichir = false) {
  chargement.value = true
  error.value = null
  try {
    data.value = await getDuplicates(source.value, rafraichir)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    chargement.value = false
  }
}

/** Somme de ce que rendrait le dédoublonnage des groupes listés. */
const gaspilleTotal = computed(() =>
  (data.value?.groupes || []).reduce((total, g) => total + g.gaspille, 0),
)
</script>

<template>
  <AdminPanel
    id="duplicates-panel"
    title="Doublons"
    subtitle="documents indexés en plusieurs exemplaires"
    :error="error"
  >
    <div class="ds-admin__actions fr-mb-2w">
      <DsfrSelect
        select-id="doublons-source"
        v-model="source"
        label="Source"
        label-visible
        :options="options"
      />
      <DsfrButton
        id="doublons-charger"
        size="sm"
        label="Analyser"
        :disabled="chargement"
        @click="charger(false)"
      />
      <!-- Le recalcul parcourt l'index pendant que les utilisateurs
           cherchent : il se demande, il ne se déclenche pas tout seul. -->
      <DsfrButton
        v-if="data"
        id="doublons-recalculer"
        size="sm"
        secondary
        label="Recalculer"
        :disabled="chargement"
        @click="charger(true)"
      />
    </div>

    <p v-if="!data" class="fr-hint-text">
      Lancer l'analyse pour voir les doublons de cette source.
    </p>

    <template v-else>
      <p class="fr-mb-1w">
        <strong>{{ data.copies_en_trop.toLocaleString('fr-FR') }}</strong> exemplaire(s) en
        trop sur {{ data.documents.toLocaleString('fr-FR') }} document(s) mesuré(s).
        <span v-if="gaspilleTotal">
          Les {{ data.groupes.length }} plus gros groupes occupent
          <strong>{{ fmtSize(gaspilleTotal) }}</strong> de copies.
        </span>
      </p>

      <!-- Distinguer « aucun doublon » de « rien n'est encore mesuré »
           évite de conclure trop vite sur un corpus non rattrapé. -->
      <DsfrAlert
        v-if="!data.documents"
        id="doublons-non-mesure"
        type="info"
        small
        description="Aucun document de cette source ne porte encore d'empreinte de contenu. Les documents indexés avant cette fonctionnalité doivent être rattrapés : ./manage.sh backfill-hashes (simulation), puis --apply."
        class="fr-mb-2w"
      />

      <p v-if="data.depuis_cache" class="fr-hint-text">
        Chiffres calculés le {{ new Date(data.calcule_le).toLocaleString('fr-FR') }}.
      </p>

      <div v-if="data.groupes.length" class="fr-table fr-table--bordered ds-stats__table">
        <table id="doublons-tableau">
          <thead>
            <tr>
              <th scope="col">Copies</th>
              <th scope="col">Place occupée en trop</th>
              <th scope="col">Où</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="groupe in data.groupes"
              :key="groupe.empreinte"
              data-testid="doublon-groupe"
              :data-empreinte="groupe.empreinte"
            >
              <td>{{ groupe.copies }}</td>
              <td>{{ fmtSize(groupe.gaspille) }}</td>
              <td>
                <ul class="fr-mb-0">
                  <li v-for="exemple in groupe.exemples" :key="exemple.filepath">
                    <code>{{ exemple.filepath }}</code>
                  </li>
                </ul>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </AdminPanel>
</template>
