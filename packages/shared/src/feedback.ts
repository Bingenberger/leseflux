/** Rückmeldung im Kinderbereich: Textstelle zur Antwort finden, Sterne vergeben. */

const STOPWORDS = new Set([
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'einer', 'und', 'oder',
  'im', 'in', 'am', 'an', 'auf', 'aus', 'bei', 'mit', 'nach', 'von', 'vor', 'zu', 'zum', 'zur', 'für',
  'er', 'sie', 'es', 'ist', 'sind', 'war', 'hat', 'haben', 'was', 'wer', 'wie', 'wo', 'wann', 'warum',
  'welche', 'welcher', 'welches', 'womit', 'wofür', 'woraus', 'wozu', 'macht', 'tut', 'sich', 'nicht',
])

function tokens(text: string): string[] {
  return (text.toLowerCase().match(/\p{L}+/gu) ?? []).filter((t) => t.length >= 3 && !STOPWORDS.has(t))
}

/** Gleicher Wortstamm (grob): gleiche ersten 5 Buchstaben bzw. gleiches kurzes Wort */
function sameStem(a: string, b: string) {
  if (a.length < 5 || b.length < 5) return a === b
  return a.slice(0, 5) === b.slice(0, 5)
}

/** Findet den Satz im Text, der die Antwort auf eine Frage am wahrscheinlichsten enthält
 *  (Wortüberschneidung mit der richtigen Antwort doppelt, mit der Frage einfach gewichtet).
 *  Gibt null zurück, wenn kein Satz passt – dann wird nichts eingeblendet. */
export function findAnswerSentence(text: string, question: string, answer: string): string | null {
  const sentences = text.match(/[^.!?]+[.!?]+["“”»«']*/g)?.map((s) => s.trim()).filter(Boolean) ?? [text.trim()]
  const answerTokens = tokens(answer)
  const questionTokens = tokens(question)

  let best: { sentence: string; score: number } | null = null
  for (const sentence of sentences) {
    const sentenceTokens = tokens(sentence)
    const hits = (list: string[]) => list.filter((t) => sentenceTokens.some((s) => sameStem(t, s))).length
    const score = 2 * hits(answerTokens) + hits(questionTokens)
    if (score > 0 && (!best || score > best.score)) best = { sentence, score }
  }
  // Nur die Frage allein genügt nicht – die Stelle soll zur Antwort führen
  return best && answerTokens.some((t) => tokens(best!.sentence).some((s) => sameStem(t, s)))
    ? best.sentence
    : null
}

/** Sterne für einen abgeschlossenen Abschnitt: Wer ihn schafft, bekommt 2 Sterne (Anstrengung
 *  zählt), den dritten für gutes Verstehen. 1 Stern nur, wenn der Abschnitt abgebrochen wurde. */
export function starsForRound(accuracy: number, completed = true, goodFrom = 0.7): 1 | 2 | 3 {
  if (!completed) return 1
  return accuracy >= goodFrom ? 3 : 2
}
