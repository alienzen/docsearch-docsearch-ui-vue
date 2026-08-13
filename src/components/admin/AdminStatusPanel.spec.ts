import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import AdminStatusPanel from './AdminStatusPanel.vue'

// Le bloc « Versions déployées » est le seul endroit qui rende visible
// une mise à jour incomplète. Ce qu'on vérifie ici est donc son unique
// décision : décider qu'il y a dérive, et NE PAS crier pour une version
// simplement inconnue — un watcher arrêté n'est pas une dérive, et une
// alerte qui se déclenche à tort finit par n'être plus lue.
//
// L'interface se décrit depuis les constantes figées au build par Vite
// (voir src/version.ts) : sous vitest, elles valent celles du fichier
// VERSION du dépôt, d'où `__DOCSEARCH_VERSION__` réutilisé dans les
// attentes plutôt qu'une chaîne en dur qui périmerait à chaque livraison.

const BASE = {
  elasticsearch: { up: true, status: 'green' },
  redis: { up: true },
  kafka: { up: true },
  tika: { up_count: 1, total: 1 },
  workers: { active_workers: 4, pending_documents: 0 },
  watcher: { alive: true, last_seen_seconds_ago: 2 },
}

function monterAvec(versions: unknown, reste: Record<string, unknown> = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ...BASE, ...reste, versions }),
      }),
    ),
  )
  return mount(AdminStatusPanel, { global: { plugins: [createPinia()] } })
}

describe('AdminStatusPanel — versions déployées', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it("n'avertit pas quand les trois briques annoncent la même version", async () => {
    const v = __DOCSEARCH_VERSION__
    const wrapper = monterAvec({
      api: { version: v, commit: 'a1b2c3d' },
      ingestion: { version: v, commit: 'a1b2c3d', source: 'watcher (ingest-1)' },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Versions déployées')
    expect(wrapper.text()).not.toContain("une mise à jour est probablement incomplète")
  })

  it('avertit quand une brique est restée sur une version antérieure', async () => {
    const wrapper = monterAvec({
      api: { version: __DOCSEARCH_VERSION__, commit: 'a1b2c3d' },
      ingestion: { version: '2.1.0', commit: '9f8e7d6', source: 'watcher (ingest-1)' },
    })
    await flushPromises()

    expect(wrapper.text()).toContain("une mise à jour est probablement incomplète")
    expect(wrapper.text()).toContain('2.1.0')
  })

  it("n'avertit pas lorsqu'aucun battement de watcher n'a été reçu", async () => {
    // `versions` sans clé « ingestion » : le watcher est arrêté ou Redis
    // a été vidé. La ligne s'affiche en « ? », mais ce n'est pas une
    // dérive de version — le bloc « État des composants » signale déjà
    // le watcher silencieux juste au-dessus.
    const wrapper = monterAvec({ api: { version: __DOCSEARCH_VERSION__, commit: 'a1b2c3d' } })
    await flushPromises()

    expect(wrapper.text()).toContain('aucun battement de watcher reçu')
    expect(wrapper.text()).not.toContain("une mise à jour est probablement incomplète")
  })

  it('signale une estampille de build absente plutôt que de la passer sous silence', async () => {
    // Cas d'une image construite sans les --build-arg de manage.sh : la
    // version produit reste juste (repli sur le fichier VERSION), mais
    // on ne sait plus de quel commit elle sort.
    const wrapper = monterAvec({
      api: { version: __DOCSEARCH_VERSION__, commit: 'inconnu', build_date: 'inconnu' },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('estampille de build absente')
  })
})

// Le bouton « Recharger » de la page remonte les autres panneaux pour
// les recharger ; celui-ci reçoit un compteur et se rafraîchit sur
// place. Ce qui se vérifie ici est ce qu'un remontage cassait : qu'aucune
// image de la transition ne montre l'écran de supervision vide.

describe('AdminStatusPanel — rechargement demandé par la page', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('garde ses cartes affichées pendant que la nouvelle requête est en vol', async () => {
    const wrapper = monterAvec({ api: { version: __DOCSEARCH_VERSION__, commit: 'a1b2c3d' } })
    await flushPromises()
    const cartes = wrapper.findAll('[data-testid="status-carte"]').length
    expect(cartes).toBeGreaterThan(0)

    await wrapper.setProps({ rechargement: 1 })
    expect(wrapper.findAll('[data-testid="status-carte"]')).toHaveLength(cartes)

    await flushPromises()
    expect(wrapper.findAll('[data-testid="status-carte"]')).toHaveLength(cartes)
    // Rafraîchi pour de bon, et pas seulement laissé en place.
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2)
  })
})

// La carte « Journalisation » existe pour un cas précis : ES refuse les
// écritures alors que TOUT LE RESTE est au vert (BASE ci-dessus décrit
// exactement cette situation — cluster « green », Redis, Kafka, workers
// et watcher en bon état). Ce qu'on vérifie donc, c'est qu'elle sait
// contredire ses voisines, et qu'elle se tait quand elle n'a rien appris.

describe('AdminStatusPanel — journalisation des recherches', () => {
  const versionsSaines = { api: { version: __DOCSEARCH_VERSION__, commit: 'a1b2c3d' } }

  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('alerte, en nommant la cause, quand la journalisation est en échec', async () => {
    const wrapper = monterAvec(versionsSaines, {
      search_log: {
        ok: false,
        last_attempt_seconds_ago: 3.2,
        error: 'ApiError(429, ...disk usage exceeded flood-stage watermark...)',
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Les recherches ne sont plus journalisées')
    expect(wrapper.text()).toContain('flood-stage watermark')
    // L'effet visible côté utilisateur, que rien d'autre ne rattache à
    // cette panne : c'est par là que le diagnostic commence en pratique.
    expect(wrapper.text()).toContain('plus de pouce')
    expect(wrapper.text()).toContain('en échec')
  })

  it("n'alerte pas quand la journalisation fonctionne", async () => {
    const wrapper = monterAvec(versionsSaines, {
      search_log: { ok: true, last_attempt_seconds_ago: 12 },
    })
    await flushPromises()

    expect(wrapper.text()).not.toContain('Les recherches ne sont plus journalisées')
    expect(wrapper.text()).toContain('dernière tentative il y a 12s')
  })

  it("reste neutre tant qu'aucune recherche n'a été journalisée", async () => {
    // Installation neuve ou Redis vidé : ne rien savoir n'est pas une
    // panne. Une carte rouge au démarrage de chaque instance apprendrait
    // à l'administrateur à ignorer ce voyant, ce qui la rendrait inutile
    // le jour où elle a quelque chose à dire.
    const wrapper = monterAvec(versionsSaines, {
      search_log: { ok: null, reason: 'aucune recherche journalisée depuis le démarrage' },
    })
    await flushPromises()

    expect(wrapper.text()).not.toContain('Les recherches ne sont plus journalisées')
    expect(wrapper.text()).toContain('inconnue')
    expect(wrapper.text()).toContain('aucune recherche journalisée depuis le démarrage')
  })
})

// Suggestions et NPS tombent pour la même raison que la journalisation —
// index passé en lecture seule — mais ils sont encore plus discrets :
// rien ne disparaît de l'écran, l'interface remercie, et la contribution
// part à la poubelle. Les cartes doivent donc savoir contredire leurs
// voisines au vert (BASE) sans se déclencher pour une simple absence
// d'information.

describe('AdminStatusPanel — suggestions et NPS', () => {
  const versionsSaines = { api: { version: __DOCSEARCH_VERSION__, commit: 'a1b2c3d' } }

  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('alerte, en nommant la cause, quand les suggestions ne sont plus enregistrées', async () => {
    const wrapper = monterAvec(versionsSaines, {
      suggestions: {
        ok: false,
        index: 'suggestions',
        error: "disque saturé (flood-stage watermark) — Elasticsearch a passé l'index en lecture seule",
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Les suggestions ne sont plus enregistrées')
    expect(wrapper.text()).toContain('flood-stage watermark')
    // L'effet côté utilisateur, que rien d'autre ne rattache à cette
    // panne — c'est par là que le diagnostic commence en pratique.
    expect(wrapper.text()).toContain('remercie pourtant')
    expect(wrapper.text()).toContain('bloquées')
  })

  it('alerte séparément de la journalisation, dont la conséquence diffère', async () => {
    // Une seule cause, deux pannes : la carte des suggestions ne doit pas
    // se contenter de suivre celle du journal, sans quoi l'administrateur
    // qui répare le disque ne saura pas qu'il a aussi des idées perdues.
    const wrapper = monterAvec(versionsSaines, {
      search_log: { ok: false, last_attempt_seconds_ago: 3, error: 'flood-stage watermark' },
      suggestions: { ok: false, error: 'flood-stage watermark' },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Les recherches ne sont plus journalisées')
    expect(wrapper.text()).toContain('Les suggestions ne sont plus enregistrées')
  })

  it('réunit les deux canaux en une seule alerte, qui les nomme', async () => {
    // Ils tombent toujours ensemble : deux blocs rouges nommant le même
    // disque saturé se liraient comme deux pannes à réparer.
    const wrapper = monterAvec(versionsSaines, {
      suggestions: { ok: false, error: 'disque saturé (flood-stage watermark)' },
      nps: { ok: false, error: 'disque saturé (flood-stage watermark)' },
    })
    await flushPromises()

    expect(wrapper.findAll('.fr-alert--error')).toHaveLength(1)
    expect(wrapper.text()).toContain('Les suggestions et les réponses NPS ne sont plus enregistrées')
    expect(wrapper.text()).toContain('les idées envoyées depuis le blocage sont perdues')
    expect(wrapper.text()).toContain('les notes de satisfaction envoyées depuis le blocage')
  })

  it('alerte pour le NPS seul quand lui seul est bloqué', async () => {
    // Cas d'un `index.blocks.write` posé à la main sur le seul index NPS :
    // le titre ne doit pas accuser les suggestions au passage.
    const wrapper = monterAvec(versionsSaines, {
      suggestions: { ok: true, index: 'suggestions' },
      nps: { ok: false, error: 'écritures bloquées sur l’index' },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Les réponses NPS ne sont plus enregistrées')
    expect(wrapper.text()).not.toContain('Les suggestions et les réponses NPS')
  })

  it("n'alerte pas quand les deux index acceptent les écritures", async () => {
    const wrapper = monterAvec(versionsSaines, {
      suggestions: { ok: true, index: 'suggestions' },
      nps: { ok: true, index: 'nps_responses' },
    })
    await flushPromises()

    expect(wrapper.text()).not.toContain('ne sont plus enregistrées')
    expect(wrapper.text()).toContain('actives')
  })

  it("reste neutre tant que les index n'ont pas encore été créés", async () => {
    const wrapper = monterAvec(versionsSaines, {
      suggestions: { ok: null, reason: 'aucune suggestion reçue à ce jour (index pas encore créé)' },
      nps: { ok: null, reason: 'aucune réponse NPS reçue à ce jour (index pas encore créé)' },
    })
    await flushPromises()

    expect(wrapper.text()).not.toContain('ne sont plus enregistrées')
    expect(wrapper.text()).toContain('aucune suggestion reçue à ce jour')
    expect(wrapper.text()).toContain('aucune réponse NPS reçue à ce jour')
  })
})
