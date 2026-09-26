import { describe, expect, it } from 'vitest'
import { findAnswerSentence, starsForRound } from '@leseflux/shared'

const TEXT = 'Der kleine Igel Fritz sucht im Garten nach leckerem Futter. Er liebt Regenwürmer und Schnecken. '
  + 'Fritz hat viele Stacheln auf dem Rücken. Wenn Gefahr droht, rollt er sich schnell zu einer Kugel zusammen. '
  + 'Im Winter schläft der Igel dann tief und fest in einem Blätternest.'

describe('findAnswerSentence', () => {
  it.each([
    ['Was hat der Igel Fritz auf dem Rücken?', 'Stacheln', 'Fritz hat viele Stacheln auf dem Rücken.'],
    ['Was frisst der Igel Fritz am liebsten?', 'Regenwürmer und Schnecken', 'Er liebt Regenwürmer und Schnecken.'],
    ['Was macht der Igel im Winter?', 'Er schläft tief und fest.', 'Im Winter schläft der Igel dann tief und fest in einem Blätternest.'],
    ['Was macht Fritz bei Gefahr?', 'Er rollt sich zu einer Kugel zusammen.', 'Wenn Gefahr droht, rollt er sich schnell zu einer Kugel zusammen.'],
  ])('%s → Satz mit der Antwort', (question, answer, expected) => {
    expect(findAnswerSentence(TEXT, question, answer)).toBe(expected)
  })

  it('blendet nichts ein, wenn die Antwort nicht im Text vorkommt', () => {
    expect(findAnswerSentence(TEXT, 'Wie heißt der Igel?', 'Otto')).toBeNull()
  })
})

describe('starsForRound', () => {
  it('gibt fürs Durchhalten 2 Sterne, für gutes Verstehen 3', () => {
    expect(starsForRound(0)).toBe(2)
    expect(starsForRound(0.5)).toBe(2)
    expect(starsForRound(0.7)).toBe(3)
    expect(starsForRound(0.8, true, 0.85)).toBe(2)
  })

  it('gibt 1 Stern nur bei Abbruch', () => {
    expect(starsForRound(1, false)).toBe(1)
  })
})
