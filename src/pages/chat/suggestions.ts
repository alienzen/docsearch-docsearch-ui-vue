/**
 * Questions proposées sous la conversation.
 *
 * Remplace `cannedResponses.ts`, qui portait aussi des réponses écrites à
 * l'avance : l'assistant existe désormais pour de bon (module
 * complémentaire servi sous /ext/assistant/), et ces questions ne sont
 * plus que des amorces — elles ne conditionnent plus la réponse.
 *
 * Délibérément génériques : une suggestion qui nommerait un document
 * précis ne vaudrait que sur le corpus de démonstration, et retomberait
 * sur « aucun document trouvé » chez un client.
 */
export const SUGGESTIONS = [
  'Quels documents parlent du budget 2024 ?',
  'Qui a écrit le dernier rapport RH ?',
  'Résume le contenu du dossier Finance',
]
