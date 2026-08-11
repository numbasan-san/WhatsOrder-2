import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ============================================
  // SEGURIDAD
  // ============================================
  
  // Eliminar el header X-Powered-By (revela información del servidor)
  poweredByHeader: false,
  
  // Activar modo estricto de React (mejores prácticas)
  reactStrictMode: true,
  
  // ============================================
  // COMPILACIÓN Y OPTIMIZACIÓN
  // ============================================
  
  // Configuración de compilación
  compiler: {
    // Eliminar console.log en producción (opcional)
    // removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // ============================================
  // IMÁGENES (opcional)
  // ============================================
  
  images: {
    domains: [], // Agregar dominios de imágenes externas si es necesario
    remotePatterns: [
      // Ejemplo: permitir imágenes de Supabase
      // {
      //   protocol: 'https',
      //   hostname: '*.supabase.co',
      // },
    ],
  },
};

export default nextConfig;