"use client";

import React, { createContext, useState, useContext, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

type AuthContextType = {
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  userId: string | null;
  // New: local role flags
  isStaffAuth?: boolean;
  isAdminAuth?: boolean;
  isReceptionAuth?: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Admin user ID to use for admin login (using a valid UUID format)
const ADMIN_USER_ID = '00000000-0000-0000-0000-000000000000';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdminAuth, setIsAdminAuth] = useState(false); // Track if user is authenticated as admin
  const [isStaffAuth, setIsStaffAuth] = useState(false); // Track if user is authenticated as staff
  const [isReceptionAuth, setIsReceptionAuth] = useState(false); // Track if user is authenticated as reception
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();

  // Check for session on initial load
  useEffect(() => {
    const fetchSession = async () => {
      try {
        // Check if admin is authenticated via localStorage first
        const adminAuth = localStorage.getItem('adminAuth');
        if (adminAuth === 'true') {
          setIsAdminAuth(true);
          setUserId(ADMIN_USER_ID);
          setIsLoading(false);
          return;
        }

        // Check if staff is authenticated via localStorage
        const staffAuth = localStorage.getItem('staffAuth');
        if (staffAuth === 'true') {
          setIsStaffAuth(true);
          // Use the same sentinel ID to ensure data visibility and operations
          setUserId(ADMIN_USER_ID);
          setIsLoading(false);
          return;
        }

        // Check if reception is authenticated via localStorage
        const receptionAuth = localStorage.getItem('receptionAuth');
        if (receptionAuth === 'true') {
          setIsReceptionAuth(true);
          setUserId(ADMIN_USER_ID);
          setIsLoading(false);
          return;
        }

        // Otherwise check Supabase session
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Error fetching session:', error);
        }

        if (session?.user) {
          setSession(session);
          setUserId(session.user.id);
        }
      } catch (error) {
        console.error('Error fetching session:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSession();

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUserId(session?.user?.id || null);
        if (!session) {
          // If session is null and admin auth was set, check if we need to maintain admin auth
          const adminAuth = localStorage.getItem('adminAuth');
          if (adminAuth === 'true') {
            setIsAdminAuth(true);
            setUserId(ADMIN_USER_ID);
          }
          // If session is null and staff auth was set, maintain staff auth
          const staffAuth = localStorage.getItem('staffAuth');
          if (staffAuth === 'true') {
            setIsStaffAuth(true);
            setUserId(ADMIN_USER_ID);
          }
          // If session is null and reception auth was set, maintain reception auth
          const receptionAuth = localStorage.getItem('receptionAuth');
          if (receptionAuth === 'true') {
            setIsReceptionAuth(true);
            setUserId(ADMIN_USER_ID);
          }
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Login function
  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    // For admin/root credentials, use simple authentication
    if ((email === 'adminacc123321098' && password === 'root121232321990@')) {
      setIsAdminAuth(true);
      setUserId(ADMIN_USER_ID);
      localStorage.setItem('adminAuth', 'true');
      return { success: true };
    }

    // For staff credentials, use simple local authentication with restrictions
    if (email === 'staff365' && password === 'staff1233284783772') {
      setIsStaffAuth(true);
      // Use sentinel so queries work consistently (view/edit allowed for now)
      setUserId(ADMIN_USER_ID);
      localStorage.setItem('staffAuth', 'true');
      return { success: true };
    }

    // For reception credentials
    if (email === 'reception' && password === 'reception365') {
      setIsReceptionAuth(true);
      setUserId(ADMIN_USER_ID);
      localStorage.setItem('receptionAuth', 'true');
      return { success: true };
    }

    // For other credentials, use Supabase authentication
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        setUserId(data.user.id);
      }

      return { success: true };
    } catch (error) {
      console.error('Error during login:', error);
      return { success: false, error: 'Invalid username or password' };
    }
  };

  // Logout function
  const logout = async () => {
    try {
      // If admin auth, clear localStorage
      if (isAdminAuth) {
        localStorage.removeItem('adminAuth');
        setIsAdminAuth(false);
        setUserId(null);
      }

      // If staff auth, clear localStorage
      if (isStaffAuth) {
        localStorage.removeItem('staffAuth');
        setIsStaffAuth(false);
        setUserId(null);
      }

      // If reception auth, clear localStorage
      if (isReceptionAuth) {
        localStorage.removeItem('receptionAuth');
        setIsReceptionAuth(false);
        setUserId(null);
      }

      // Also sign out from Supabase (won't hurt even if not signed in)
      await supabase.auth.signOut();

      router.push('/login');
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  return (
    <AuthContext.Provider value={{
      session,
      isAuthenticated: !!session || isAdminAuth || isStaffAuth || isReceptionAuth,
      isLoading,
      login,
      logout,
      userId: userId,
      isStaffAuth,
      isAdminAuth,
      isReceptionAuth
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 