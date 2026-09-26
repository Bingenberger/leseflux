import { describe, expect, it } from 'vitest'
import { chooseTextLevel, gradeFromClassName } from './textLevel.js'

describe('gradeFromClassName', () => {
  it.each([
    ['3a', 3],
    ['4 b', 4],
    ['Klasse 2c', 2],
    ['2', 2],
    ['Igel-Klasse', null],
    ['', null],
  ])('%s → %s', (name, grade) => {
    expect(gradeFromClassName(name)).toBe(grade)
  })
})

describe('chooseTextLevel', () => {
  const base = { gradeLevel: 4, averageQuizAccuracy: 0.7, targetWpm: 60 }

  it('gibt einem langsamen Kind der 4. Klasse Stufe-4-Texte', () => {
    expect(chooseTextLevel(base)).toBe(4)
  })

  it('geht bei schwachem Verständnis eine Stufe herunter', () => {
    expect(chooseTextLevel({ ...base, averageQuizAccuracy: 0.4 })).toBe(3)
  })

  it('geht bei sehr gutem Verständnis eine Stufe hoch, höchstens bis 4', () => {
    expect(chooseTextLevel({ ...base, gradeLevel: 2, averageQuizAccuracy: 0.95 })).toBe(3)
    expect(chooseTextLevel({ ...base, averageQuizAccuracy: 0.95 })).toBe(4)
  })

  it('bleibt ohne Verständnisdaten bei der Klassenstufe', () => {
    expect(chooseTextLevel({ ...base, gradeLevel: 3, averageQuizAccuracy: null })).toBe(3)
  })

  it('begrenzt Klassenstufen außerhalb des Korpus auf 2–4', () => {
    expect(chooseTextLevel({ ...base, gradeLevel: 1 })).toBe(2)
    expect(chooseTextLevel({ ...base, gradeLevel: 6 })).toBe(4)
  })

  it('nutzt den Klassennamen, wenn keine Stufe gesetzt ist', () => {
    expect(chooseTextLevel({ ...base, gradeLevel: null, className: '3b' })).toBe(3)
  })

  it('fällt ohne Klasseninfo auf das Tempo zurück', () => {
    expect(chooseTextLevel({ ...base, gradeLevel: null, className: 'Igel', targetWpm: 60 })).toBe(2)
  })
})
