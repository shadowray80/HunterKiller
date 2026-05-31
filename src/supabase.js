import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
);

// ── PLAYER IDENTITY ──
// Sign in anonymously — gives each device a persistent UUID
export async function ensureAuth() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) return session.user;
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.error('Auth error:', error);
      return { _authError: error.message };
    }
    return data?.user || null;
  } catch (e) {
    console.error('Auth exception:', e);
    return { _authError: e.message };
  }
}

export function getUser() {
  return supabase.auth.getUser().then(({ data }) => data.user);
}
