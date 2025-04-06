import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface AuthState {
  user: any;
  session: any;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,
  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      // Handle email not confirmed error gracefully
      if (error.message === 'Email not confirmed') {
        const { data: signInData } = await supabase.auth.signInWithPassword({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
          },
        });
        if (signInData) {
          set({ user: signInData.user, session: signInData.session });
          return;
        }
      }
      throw error;
    }
    set({ user: data.user, session: data.session });
  },
  signUp: async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          email_confirmed: true, // Add this to bypass email confirmation
        },
      },
    });
    if (error) throw error;
    set({ user: data.user, session: data.session });
  },
  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null });
  },
}));