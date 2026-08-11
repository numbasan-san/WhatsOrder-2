/**
 * Verifica que todas las variables de entorno necesarias estén configuradas
 */
export function checkEnvironmentVariables(): {
  valid: boolean
  missing: string[]
} {
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_SECRET_KEY',
    'TELEGRAM_BOT_TOKEN',
    'GEMINI_API_TOKEN'
  ]

  const missing: string[] = []

  requiredVars.forEach(varName => {
    if (!process.env[varName]) {
      missing.push(varName)
    }
  })

  return {
    valid: missing.length === 0,
    missing
  }
}

// Ejecutar en desarrollo
if (process.env.NEXT_PUBLIC_APP_ENV === 'development') {
  const { valid, missing } = checkEnvironmentVariables()
  if (!valid) {
    console.warn('⚠️ Variables de entorno faltantes:', missing.join(', '))
  }
}