import { describe, expect, it } from 'vitest'
import { selectBalancedItems } from './itemSelection.js'

const items = [1, 2, 3].flatMap((difficulty) =>
  Array.from({ length: 8 }, (_, i) => ({ id: `d${difficulty}-${i}`, difficulty })),
)

describe('selectBalancedItems', () => {
  it('verteilt die Auswahl gleichmäßig auf die Stufen', () => {
    const selected = selectBalancedItems(items, 12)
    for (const difficulty of [1, 2, 3]) {
      expect(selected.filter((item) => item.difficulty === difficulty)).toHaveLength(4)
    }
  })

  it('bevorzugt Sätze, die das Kind noch nicht gesehen hat', () => {
    const seen = new Set(items.filter((item) => Number(item.id.split('-')[1]) < 4).map((item) => item.id))
    for (let run = 0; run < 10; run++) {
      const selected = selectBalancedItems(items, 12, seen)
      expect(selected.every((item) => !seen.has(item.id))).toBe(true)
    }
  })

  it('greift auf gesehene Sätze zurück, wenn neue nicht reichen', () => {
    const seen = new Set(items.filter((item) => item.id !== 'd1-0').map((item) => item.id))
    const selected = selectBalancedItems(items, 24, seen)
    expect(selected).toHaveLength(24)
    expect(selected.map((item) => item.id)).toContain('d1-0')
  })

  it('gibt jeden Satz höchstens einmal zurück', () => {
    const selected = selectBalancedItems(items, 30)
    expect(new Set(selected.map((item) => item.id)).size).toBe(selected.length)
    expect(selected).toHaveLength(24)
  })
})
