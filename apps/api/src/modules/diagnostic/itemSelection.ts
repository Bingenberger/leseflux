/** Satzauswahl für Diagnostiken.
 *  Ausgewogen über Schwierigkeitsstufen; Sätze, die das Kind schon einmal beurteilt hat,
 *  kommen nur zum Zug, wenn es in der Stufe nicht genug neue gibt (Parallelformen statt
 *  Wiedererkennen derselben Sätze bei jeder Zwischendiagnostik). */

type Rng = () => number

function shuffle<T>(arr: T[], rng: Rng = Math.random): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const current = a[i]!
    a[i] = a[j]!
    a[j] = current
  }
  return a
}

export function selectBalancedItems<T extends { id: string; difficulty: number }>(
  items: T[],
  itemCount: number,
  seenItemIds: Set<string> = new Set(),
  rng: Rng = Math.random,
): T[] {
  const byDifficulty = new Map<number, T[]>()
  for (const item of items) {
    const bucket = byDifficulty.get(item.difficulty) ?? []
    bucket.push(item)
    byDifficulty.set(item.difficulty, bucket)
  }

  const difficulties = [...byDifficulty.keys()].sort((a, b) => a - b)
  if (difficulties.length === 0) return []

  // Pro Stufe: erst ungesehene, dann gesehene Sätze (jeweils zufällig gemischt)
  const orderedBuckets = new Map(
    difficulties.map((difficulty) => {
      const bucket = byDifficulty.get(difficulty)!
      return [difficulty, [
        ...shuffle(bucket.filter((item) => !seenItemIds.has(item.id)), rng),
        ...shuffle(bucket.filter((item) => seenItemIds.has(item.id)), rng),
      ]]
    }),
  )
  const base = Math.floor(itemCount / difficulties.length)
  let remainder = itemCount % difficulties.length
  const selected: T[] = []

  for (const difficulty of difficulties) {
    const take = base + (remainder > 0 ? 1 : 0)
    remainder = Math.max(0, remainder - 1)
    selected.push(...(orderedBuckets.get(difficulty) ?? []).splice(0, take))
  }

  if (selected.length < itemCount) {
    const selectedSet = new Set(selected)
    const remaining = items.filter((item) => !selectedSet.has(item))
    const ordered = [
      ...shuffle(remaining.filter((item) => !seenItemIds.has(item.id)), rng),
      ...shuffle(remaining.filter((item) => seenItemIds.has(item.id)), rng),
    ]
    selected.push(...ordered.slice(0, itemCount - selected.length))
  }

  return shuffle(selected, rng).slice(0, itemCount)
}
