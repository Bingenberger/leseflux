/** Silben-Hilfen für die Anzeige (Silbenfärbung) und das Fading-Timing.
 *  Arbeitet ohne Wörterbuch: Vokalkerne zählen, Doppellaute (ei, au, eu, ie …) als ein Kern. */

const VOWEL = /[aeiouäöüy]/i

/** Vokalfolgen, die zusammen EINEN Silbenkern bilden (Diphthonge, Dehnungen) */
const NUCLEUS_PAIRS = new Set(['ai', 'au', 'ay', 'ei', 'ey', 'eu', 'äu', 'ie', 'aa', 'ee', 'oo'])

function isVowel(ch: string | undefined) {
  return ch !== undefined && VOWEL.test(ch)
}

/** Vokal an Position i – „u“ nach „q“ ist konsonantisch („Quelle“) */
function vowelAt(text: string, i: number) {
  return isVowel(text[i]) && !(text[i]?.toLowerCase() === 'u' && text[i - 1]?.toLowerCase() === 'q')
}

/** Zerlegt eine Vokalfolge in Silbenkerne, z. B. „eue“ → [„eu“, „e“], „ia“ → [„i“, „a“]. */
function splitNuclei(vowels: string): string[] {
  const nuclei: string[] = []
  let i = 0
  while (i < vowels.length) {
    const pair = vowels.slice(i, i + 2).toLowerCase()
    if (pair.length === 2 && NUCLEUS_PAIRS.has(pair)) {
      nuclei.push(vowels.slice(i, i + 2))
      i += 2
    } else {
      nuclei.push(vowels[i]!)
      i += 1
    }
  }
  return nuclei
}

/** Anzahl der Sprechsilben eines Wortes (mindestens 1). Satzzeichen werden ignoriert. */
export function countSyllables(word: string): number {
  const letters = word.replace(/[^\p{L}]/gu, '').replace(/qu/gi, 'qv')
  const groups = letters.match(/[aeiouäöüy]+/gi) ?? []
  const count = groups.reduce((sum, group) => sum + splitNuclei(group).length, 0)
  return Math.max(1, count)
}

/** Trennt innerhalb eines Teils zwei aufeinanderfolgende Silbenkerne („Mia“ → „Mi|a“, „neue“ → „neu|e“). */
function splitHiatus(part: string): string[] {
  const out: string[] = []
  let current = ''
  let i = 0
  while (i < part.length) {
    if (!vowelAt(part, i)) {
      current += part[i]
      i += 1
      continue
    }
    let j = i
    while (j < part.length && vowelAt(part, j)) j += 1
    const nuclei = splitNuclei(part.slice(i, j))
    current += nuclei[0]
    for (const nucleus of nuclei.slice(1)) {
      out.push(current)
      current = nucleus
    }
    i = j
  }
  out.push(current)
  return out
}

/** Einzelner Anfangsvokal vor genau einem Konsonanten und einem Vokal bildet eine eigene Silbe
 *  („über“ → „ü|ber“, „Idee“ → „I|dee“), was Trennmuster wegen der Mindestlänge auslassen. */
function splitInitialVowel(part: string): string[] {
  if (part.length >= 3 && vowelAt(part, 0) && !vowelAt(part, 1) && vowelAt(part, 2)) {
    return [part.slice(0, 1), part.slice(1)]
  }
  return [part]
}

/** Verfeinert Trennstellen aus Silbentrennmustern zu Sprechsilben.
 *  Erwartet die Teile eines Wortes ohne umgebende Satzzeichen. */
export function refineSyllables(parts: string[]): string[] {
  const refined = parts.flatMap((part, index) =>
    (index === 0 ? splitInitialVowel(part) : [part]).flatMap(splitHiatus),
  )
  return refined.filter((part) => part.length > 0)
}
