declare namespace NodeJS {
  interface ProcessEnv {
    // Supabase
    NEXT_PUBLIC_SUPABASE_URL: string
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: string
    SUPABASE_SECRET_KEY: string
    NEXT_PUBLIC_SUPABASE_JWKS_URL?: string

    // Telegram
    TELEGRAM_BOT_TOKEN: string
    TELEGRAM_BOT_API_URL?: string
    TELEGRAM_WEBHOOK_SECRET?: string

    // Gemini
    GEMINI_API_TOKEN: string
    GEMINI_MODEL?: string

    // ERP
    ERP_API_URL?: string
    ERP_API_KEY?: string

    // General
    NEXT_PUBLIC_APP_ENV?: 'development' | 'staging' | 'production'
  }
}