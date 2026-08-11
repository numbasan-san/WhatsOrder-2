'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { UserProfile } from '@/types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isAdmin: boolean;
  isSupervisor: boolean;
  isCSR: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const loadProfile = useCallback(async (userId: string) => {
    try {
      // Intentar obtener el perfil directamente
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // Si es error de recursión o tabla no existe
        if (error.code === '42P17' || error.code === '42P01') {
          console.warn('Error con RLS o tabla, intentando crear perfil...');
          
          // Intentar crear el perfil directamente
          const { data: newProfile, error: insertError } = await supabase
            .from('user_profiles')
            .upsert({
              id: userId,
              full_name: 'Usuario',
              role: 'csr'
            }, {
              onConflict: 'id'
            })
            .select()
            .single();

          if (insertError) {
            console.error('Error creando perfil:', insertError);
            // Usar datos por defecto sin guardar en DB
            setProfile({
              id: userId,
              full_name: 'Usuario',
              role: 'csr',
              department: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
            return;
          }

          if (newProfile) {
            setProfile(newProfile);
            return;
          }
        }

        console.error('Error loading profile:', error);
        return;
      }

      if (data) {
        setProfile(data);
      } else {
        // Si no hay datos, crear perfil
        const { data: newProfile, error: insertError } = await supabase
          .from('user_profiles')
          .insert({
            id: userId,
            full_name: 'Usuario',
            role: 'csr'
          })
          .select()
          .single();

        if (!insertError && newProfile) {
          setProfile(newProfile);
        }
      }
    } catch (error) {
      console.warn('Error cargando perfil (ignorado):', error);
      // Setear un perfil por defecto para no romper la app
      setProfile({
        id: userId,
        full_name: 'Usuario',
        role: 'csr',
        department: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
  }, [supabase]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, newSession: Session | null) => {
        console.log('Auth state change:', event);
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          loadProfile(newSession.user.id);
        } else {
          setProfile(null);
        }

        setLoading(false);
      }
    );

    // Cargar sesión inicial
    supabase.auth.getSession().then(({ data: { session: initialSession } }: { data: { session: Session | null } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      
      if (initialSession?.user) {
        loadProfile(initialSession.user.id);
      }
      
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      
      return { error: null };
    } catch (error) {
      console.error('Sign in error:', error);
      return { error };
    }
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
  }, [supabase]);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await loadProfile(user.id);
    }
  }, [user, loadProfile]);

  const isAdmin = profile?.role === 'admin';
  const isSupervisor = profile?.role === 'supervisor' || isAdmin;
  const isCSR = profile?.role === 'csr' || isSupervisor;

  const value = {
    user,
    profile,
    session,
    loading,
    signIn,
    signOut,
    refreshProfile,
    isAdmin,
    isSupervisor,
    isCSR,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }
  return ctx;
}