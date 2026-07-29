#!/usr/bin/env node
/**
 * Confronte le parseur de syntaxe avancée porté en TypeScript
 * (src/api/search.ts) à l'implémentation d'origine, lue directement dans
 * docsearch-ui/public/js/search.js, sur une batterie d'entrées.
 *
 *     node tools/compare-parseur.mjs
 *
 * C'est le filet de sécurité du portage : les tests Vitest décrivent le
 * comportement ATTENDU, ce script vérifie qu'il est bien celui de
 * l'ancienne interface — y compris sur les cas auxquels personne n'avait
 * pensé en écrivant les tests.
 *
 * À supprimer le jour où docsearch-ui sera retiré (le script s'arrête de
 * lui-même avec un message clair si le fichier d'origine a disparu).
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const legacyPath = resolve(projectRoot, '../docsearch-ui/public/js/search.js')

let src
try {
  src = readFileSync(legacyPath, 'utf8')
} catch {
  console.error(
    `Implémentation d'origine introuvable : ${legacyPath}\n` +
      "Si docsearch-ui a été retiré, ce script n'a plus lieu d'être — le supprimer.",
  )
  process.exit(2)
}

// Extraction du bloc parseur d'origine (des opérateurs jusqu'au
// commentaire de hasActiveCriteria), évalué tel quel. `customFacetOperators`
// y est une variable globale d'un autre fichier : on la remplace par un
// accès à une variable locale que chaque cas de test réaffecte.
const start = src.indexOf('const ADVANCED_QUERY_OPERATORS')
const end = src.indexOf("// Vrai s'il y a quelque chose")
if (start < 0 || end < 0) {
  console.error(
    "Le bloc parseur n'a pas pu être localisé dans search.js — " +
      'le fichier d’origine a dû être remanié. Ajuster les repères d’extraction.',
  )
  process.exit(2)
}
let customFacetOperators = {}
const legacy = new Function(
  'getCustom',
  src.slice(start, end).replace(/customFacetOperators/g, 'getCustom()') +
    '\nreturn parseAdvancedQuery;',
)(() => customFacetOperators)

// Le port est en TypeScript : on le transpile dans un dossier temporaire
// avec l'esbuild déjà présent dans node_modules (via Vite).
const outDir = mkdtempSync(join(tmpdir(), 'docsearch-parseur-'))
const outFile = join(outDir, 'search.mjs')
try {
  execFileSync(
    'npx',
    ['esbuild', 'src/api/search.ts', '--bundle', '--format=esm', `--outfile=${outFile}`],
    { cwd: projectRoot, stdio: 'pipe' },
  )
  var { parseAdvancedQuery: ported } = await import(pathToFileURL(outFile).href)
} finally {
  rmSync(outDir, { recursive: true, force: true })
}

// Facettes SQL personnalisées, telles que les expose /custom-facets.
const CUSTOM = { bureau: 'bureau', num_tel: 'num_tel' }

const cases = [
  // Cas courants
  ['rapport annuel 2024', {}],
  ['type:pdf rapport', {}],
  ['type:PDF', {}],
  ['type:.PDF', {}],
  ['auteur:"Jean Dupont" bilan', {}],
  ['folder:Finance', {}],
  ['keyword:urgent', {}],
  ['type:pdf type:docx', {}],
  ['type:pdf auteur:"Jean Dupont" rapport annuel', {}],
  ['dossier:"Direction générale" auteur:dupont mots-cles:budget note', CUSTOM],
  // Facettes SQL personnalisées
  ['bureau:Paris agents', CUSTOM],
  ['num_tel:0102030405', CUSTOM],
  ['bureau:Paris bureau:Lyon', CUSTOM],
  // Les dimensions communes priment sur une facette SQL homonyme
  ['source:agents', { source: 'source_sql' }],
  ['auteur:dupont', { auteur: 'champ_sql' }],
  // Pièges : ne doivent PAS être avalés comme des opérateurs
  ['foo:bar rapport', {}],
  ['http://exemple.fr/doc type:pdf', {}],
  ['ratio 3:1 et 16:9', {}],
  ['"budget 2024"', {}],
  // Cas limites
  ['auteur: rapport', {}],
  ['auteur:""', {}],
  ['rapport type:pdf   annuel', {}],
  ['MOTS-CLES:urgent Type:PDF', {}],
  ['   ', {}],
]

let divergences = 0
for (const [text, custom] of cases) {
  customFacetOperators = custom
  const origine = JSON.stringify(legacy(text))
  const port = JSON.stringify(ported(text, custom))
  if (origine !== port) {
    divergences++
    console.log(`DIVERGENCE ${JSON.stringify(text)}\n  origine: ${origine}\n  port   : ${port}`)
  }
}

if (divergences === 0) {
  console.log(`OK — ${cases.length} cas, comportement identique à l'implémentation d'origine.`)
} else {
  console.error(`${divergences} divergence(s) sur ${cases.length} cas.`)
  process.exit(1)
}
