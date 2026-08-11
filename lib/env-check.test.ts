import { describe, it, expect, afterEach } from 'vitest'
import { checkEnvironmentVariables } from './env-check'

const REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'TELEGRAM_BOT_TOKEN',
  'GEMINI_API_TOKEN',
]

describe('checkEnvironmentVariables', () => {
  const saved: Record<string, string | undefined> = {}

  afterEach(() => {
    for (const k of REQUIRED) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  })

  it('reports every required var as missing when none are set', () => {
    for (const k of REQUIRED) { saved[k] = process.env[k]; delete process.env[k] }
    const { valid, missing } = checkEnvironmentVariables()
    expect(valid).toBe(false)
    expect(missing).toEqual(expect.arrayContaining(REQUIRED))
  })

  it('flags exactly the one missing var (e.g. SUPABASE_SECRET_KEY)', () => {
    for (const k of REQUIRED) { saved[k] = process.env[k]; process.env[k] = 'x' }
    process.env.SUPABASE_SECRET_KEY = '' // falsy => treated as missing
    const { valid, missing } = checkEnvironmentVariables()
    expect(valid).toBe(false)
    expect(missing).toEqual(['SUPABASE_SECRET_KEY'])
  })

  it('is valid when all required vars are set', () => {
    for (const k of REQUIRED) { saved[k] = process.env[k]; process.env[k] = 'x' }
    expect(checkEnvironmentVariables().valid).toBe(true)
  })
})
