'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'supervisor' | 'csr';
}

export default function AuthGuard({ children, requiredRole }: AuthGuardProps) {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
        return;
      }

      if (requiredRole) {
        const roles = {
          admin: ['admin'],
          supervisor: ['admin', 'supervisor'],
          csr: ['admin', 'supervisor', 'csr'],
        };

        const allowedRoles = roles[requiredRole] || [];
        if (!allowedRoles.includes(profile?.role || '')) {
          router.push('/dashboard');
        }
      }
    }
  }, [user, profile, loading, router, requiredRole]);

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-slate-500 dark:text-slate-400">Cargando...</div>
      </div>
    );
  }

  return <>{children}</>;
}