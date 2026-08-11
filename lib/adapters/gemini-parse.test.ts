import { describe, it, expect } from 'vitest'
import { cleanJsonResponse, parseGeminiOrder, wordToNumber } from './gemini-parse'

describe('wordToNumber', () => {
  it('maps spanish number words', () => {
    expect(wordToNumber('dos')).toBe(2)
    expect(wordToNumber('TRES')).toBe(3)
    expect(wordToNumber('veinte')).toBe(20)
  })
  it('returns null for non-numbers', () => {
    expect(wordToNumber('salami')).toBeNull()
  })
})

describe('cleanJsonResponse', () => {
  it('strips code fences', () => {
    expect(cleanJsonResponse('```json\n{"a":1}\n```')).toBe('{"a":1}')
  })
  it('trims text around the object', () => {
    expect(cleanJsonResponse('Here: {"a":1} thanks')).toBe('{"a":1}')
  })
})

describe('parseGeminiOrder', () => {
  it('parses items with name+quantity', () => {
    const r = parseGeminiOrder('{"items":[{"name":"leche","quantity":2},{"name":"pan","quantity":1}]}')
    expect(r.items).toEqual([{ name: 'leche', quantity: 2 }, { name: 'pan', quantity: 1 }])
  })
  it('accepts spanish keys and extracts address', () => {
    const r = parseGeminiOrder('{"items":[{"nombre":"arroz","cantidad":3}],"direccion":"Calle 5"}')
    expect(r.items).toEqual([{ name: 'arroz', quantity: 3 }])
    expect(r.deliveryAddress).toBe('Calle 5')
  })
  it('returns empty items on garbage', () => {
    expect(parseGeminiOrder('not json').items).toEqual([])
  })
  it('recovers quantity from message when model omits it', () => {
    const r = parseGeminiOrder('{"items":[{"name":"salami"}]}', 'quiero tres salami')
    expect(r.items[0].quantity).toBe(3)
  })
  it('recovers digit quantity from message', () => {
    const r = parseGeminiOrder('{"items":[{"name":"pan"}]}', 'dame 4 pan')
    expect(r.items[0].quantity).toBe(4)
  })
  it('defaults to 1 when nothing found', () => {
    const r = parseGeminiOrder('{"items":[{"name":"pan"}]}', 'pan')
    expect(r.items[0].quantity).toBe(1)
  })
})
