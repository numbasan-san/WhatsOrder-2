import { describe, it, expect } from 'vitest'
import { cleanJsonResponse, parseGeminiOrder } from './gemini-parse'

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
})
