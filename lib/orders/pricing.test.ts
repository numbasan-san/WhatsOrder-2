import { describe, it, expect } from 'vitest'
import { normalizeName, matchScore, matchItemsToCatalog, orderTotal, buildOrderSummary } from './pricing'
import type { Producto } from '@/lib/types'

const catalog: Producto[] = [
  { id: '1', sku: 'leche-1l', name: 'Leche entera 1L', price: 65, stock: 10, active: true },
  { id: '2', sku: 'pan-molde', name: 'Pan de molde', price: 95, stock: 10, active: true },
]

describe('matchScore', () => {
  it('scores more matching tokens higher', () => {
    expect(matchScore('leche', 'Leche entera 1L')).toBeGreaterThan(0)
    expect(matchScore('leche entera', 'Leche entera 1L')).toBeGreaterThan(matchScore('leche', 'Leche entera 1L'))
  })
  it('scores unrelated as zero', () => {
    expect(matchScore('dragon', 'Leche entera 1L')).toBe(0)
  })
})

describe('normalizeName', () => {
  it('lowercases, strips accents and spaces', () => {
    expect(normalizeName('  Leche  Entera 1L ')).toBe('leche entera 1l')
    expect(normalizeName('Café')).toBe('cafe')
  })
})

describe('matchItemsToCatalog', () => {
  it('matches by normalized name and prices from catalog', () => {
    const r = matchItemsToCatalog([{ name: 'leche entera 1L', quantity: 2 }], catalog)
    expect(r.items).toEqual([{ sku: 'leche-1l', product: 'Leche entera 1L', quantity: 2, price: 65, subtotal: 130 }])
    expect(r.unmatched).toEqual([])
  })
  it('matches on partial contains (leche -> Leche entera 1L)', () => {
    const r = matchItemsToCatalog([{ name: 'leche', quantity: 1 }], catalog)
    expect(r.items[0].sku).toBe('leche-1l')
  })
  it('reports unmatched and excludes them', () => {
    const r = matchItemsToCatalog([{ name: 'dragon', quantity: 1 }], catalog)
    expect(r.items).toEqual([])
    expect(r.unmatched).toEqual(['dragon'])
  })
  it('clamps quantity to >= 1', () => {
    const r = matchItemsToCatalog([{ name: 'pan', quantity: 0 }], catalog)
    expect(r.items[0].quantity).toBe(1)
  })
  it('ranks the best-scoring candidate, not the first loose match', () => {
    const local: Producto[] = [
      { id: '3', sku: 'leche-desc', name: 'Leche descremada 1L', price: 70, stock: 10, active: true },
      { id: '1', sku: 'leche-1l', name: 'Leche entera 1L', price: 65, stock: 10, active: true },
    ]
    const r = matchItemsToCatalog([{ name: 'leche entera', quantity: 1 }], local)
    expect(r.items[0].sku).toBe('leche-1l')
  })
})

describe('orderTotal', () => {
  it('sums subtotals', () => {
    expect(orderTotal([{ sku: 'a', product: 'A', quantity: 2, price: 65, subtotal: 130 }])).toBe(130)
  })
})

describe('buildOrderSummary', () => {
  it('includes total in DOP and address', () => {
    const msg = buildOrderSummary(
      [{ sku: 'leche-1l', product: 'Leche entera 1L', quantity: 2, price: 65, subtotal: 130 }], 130, 'Calle 1')
    expect(msg).toContain('Leche entera 1L')
    expect(msg).toContain('130')
    expect(msg).toContain('Calle 1')
  })
})
