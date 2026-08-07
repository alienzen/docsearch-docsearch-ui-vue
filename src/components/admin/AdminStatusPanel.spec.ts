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

function monterAvec(versions: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ...BASE, versions }),
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
