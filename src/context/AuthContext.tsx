import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';

export type UserRole = 'SUPER ADMIN' | 'admin' | 'editor' | 'visualizador';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole; // This will be the "current" role or "SUPER ADMIN"
  is_super_admin: boolean;
  must_change_password?: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        fetchProfile(session);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        fetchProfile(session);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (session: Session) => {
    try {
      if (!session.user || !session.user.email) return;

      // 1. Fetch Profile for is_super_admin
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
      }

      const isSuperAdmin = profile?.is_super_admin || false;
      let role: UserRole = isSuperAdmin ? 'SUPER ADMIN' : 'visualizador'; // Default to visualizador if not found
      let name = profile?.full_name || session.user.user_metadata?.full_name || session.user.email;
      const mustChangePassword = session.user.user_metadata?.must_change_password || false;

      // 2. If not Super Admin, try to fetch a membership role (just to populate the initial state)
      // The CompanyContext will handle the specific company role later.
      if (!isSuperAdmin) {
         const { data: member } = await supabase
            .from('organization_members')
            .select('role')
            .eq('user_id', session.user.id)
            .limit(1)
            .single();
         
         if (member) {
             role = member.role as UserRole;
         }
      }

      setUser({
        id: session.user.id,
        email: session.user.email,
        name,
        role,
        is_super_admin: isSuperAdmin,
        must_change_password: mustChangePassword,
      });
    } catch (error) {
      console.error('Error in fetchProfile:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Login error:', error.message);
      return false;
    }
    return true;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
