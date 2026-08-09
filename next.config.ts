import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    '@supabase/supabase-js',
    '@supabase/ssr',
    '@supabase/auth-js',
    '@supabase/postgrest-js',
    '@supabase/realtime-js',
    '@supabase/storage-js'
  ],
};

export default nextConfig;