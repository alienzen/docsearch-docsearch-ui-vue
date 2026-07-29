/**
 * Réponses préenregistrées de la démonstration d'assistant.
 *
 * ⚠️ AUCUN backend RAG n'est appelé : l'endpoint /ask n'existe pas côté
 * docsearch-api (vérifié — il répond 404). Cette page simule une
 * conversation plausible pour donner un aperçu de l'expérience visée,
 * sans faire croire à une fonctionnalité réellement branchée. Le badge
 * « réponses de démonstration » de l'écran est là pour ça et ne doit pas
 * être retiré tant que le RAG n'existe pas.
 *
 * Le jour où /ask existera, c'est ce fichier qui disparaîtra, remplacé
 * par un appel réel dans src/api/.
 */
export type CannedResponse = {
  match: RegExp
  /** Segments de texte ; `strong` met en valeur sans passer par du HTML. */
  answer: { text: string; strong?: boolean }[]
  sources: string[]
}

export const CANNED_RESPONSES: CannedResponse[] = [
  {
    match: /budget|financ|finance/i,
    answer: [
      { text: "D'après les documents indexés, le " },
      { text: 'Budget prévisionnel 2024', strong: true },
      {
        text: ' (Finance/Budgets, par Claire Martin) compare les prévisions aux chiffres réalisés de 2023, avec un écart global de +2,4%. Le ',
      },
      { text: 'Rapport annuel 2023', strong: true },
      { text: " (Finance/Rapports) détaille une croissance de 12% du chiffre d'affaires." },
    ],
    sources: ['Budget prévisionnel 2024 vs réalisé 2023', 'Rapport annuel 2023 — Direction financière'],
  },
  {
    match: /rh|ressources humaines|effectif/i,
    answer: [
      { text: 'Le document le plus récent du dossier RH est la ' },
      { text: 'Synthèse rapport annuel 2023 — RH', strong: true },
      {
        text: ', rédigée par Sophie Bernard. Il indique une progression des effectifs de 8% et un taux de turnover stable à 4,2%.',
      },
    ],
    sources: ['Synthèse rapport annuel 2023 — RH'],
  },
  {
    match: /qui a écrit|auteur/i,
    answer: [
      { text: 'Les documents les plus fréquemment mis à jour proviennent principalement de ' },
      { text: 'Martin Dupont', strong: true },
      { text: ' (Direction/Finance) et ' },
      { text: 'Sophie Bernard', strong: true },
      { text: ' (RH/Juridique). Voulez-vous que je filtre par auteur dans la recherche ?' },
    ],
    sources: [],
  },
  {
    match: /résum|synthé/i,
    answer: [
      {
        text: "Voici une synthèse basée sur les documents du dossier concerné : plusieurs rapports abordent la clôture de l'exercice 2023, avec une tendance à la hausse des indicateurs clés et quelques points d'attention identifiés lors de l'audit interne.",
      },
    ],
    sources: ['Audit interne — exercice 2023'],
  },
]

export const DEFAULT_ANSWER: CannedResponse['answer'] = [
  {
    text: "Je n'ai pas trouvé de réponse précise à cette question dans les documents indexés pour cette démonstration. Essayez une des suggestions ci-dessus, ou utilisez la recherche classique pour explorer le corpus complet.",
  },
]

export const SUGGESTIONS = [
  'Quels documents parlent du budget 2024 ?',
  'Qui a écrit le dernier rapport RH ?',
  'Résume le contenu du dossier Finance',
]

export function findResponse(question: string): CannedResponse {
  return (
    CANNED_RESPONSES.find((r) => r.match.test(question)) ?? {
      match: /.*/,
      answer: DEFAULT_ANSWER,
      sources: [],
    }
  )
}
