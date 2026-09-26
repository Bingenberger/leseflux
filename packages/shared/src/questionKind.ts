/** Verstehensebene einer Frage, angelehnt an IGLU:
 *  WOERTLICH – steht so im Text; SCHLUSSFOLGERND – muss aus dem Text erschlossen werden;
 *  BEWERTEND – eigene Meinung/Bewertung zum Text. */
export type QuestionKind = 'WOERTLICH' | 'SCHLUSSFOLGERND' | 'BEWERTEND'

const EVALUATIVE = /^(was (denkst|meinst|würdest|hättest|findest)|wie (findest|hättest|würdest)|findest du|würdest du|hättest du|möchtest du|magst du)\b/i
const INFERENTIAL = /^(warum|wieso|weshalb|woran|was bedeutet|was heißt|was lernt|was passiert,? wenn|was wäre|wie fühlt|wie fühlte|wie geht es|was ist (wohl|vermutlich)|was könnte|was wollte)\b/i

/** Ordnet eine Frage heuristisch einer Verstehensebene zu (am Fragebeginn). */
export function classifyQuestion(question: string): QuestionKind {
  const q = question.trim()
  if (EVALUATIVE.test(q)) return 'BEWERTEND'
  if (INFERENTIAL.test(q)) return 'SCHLUSSFOLGERND'
  return 'WOERTLICH'
}
