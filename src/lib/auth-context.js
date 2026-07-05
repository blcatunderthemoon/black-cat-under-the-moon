/**
 * src/lib/auth-context.js
 * React context for client-side auth state.
 * Manages the Supabase session on the client.
 */

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { resolveBrowserSession, readStoredAuthSession, sessionFromStored } from './browser-session.js';
import { resolveDisplayName } from './display-name.js';
import { readMeCache, writeMeCache, clearMeCache } from './me-cache.js';
import { clearInboxThreadsCache } from './inbox-threads-cache.js';
import { clearMoonJourneyCache } from './moon-journey-cache.js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Singleton browser client
let _client = null;
export function getBrowserClient() {
  if (!_client && supabaseUrl && supabaseAnonKey) {
    _client = createClient(supabaseUrl, supabaseAnonKey);
  }
  return _client;
}

const AuthContext = createContext(null);

/** Canonical origin for Supabase email links (signup confirm, password reset). */
function getSiteOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (configured) return configured;
  if (typeof window !== 'undefined') return window.location.origin;
  return undefined;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const client = getBrowserClient();
    if (!client) {
      setSession(null);
      return;
    }

    let cancelled = false;

    const stored = readStoredAuthSession();
    const immediate = sessionFromStored(stored);
    if (immediate) {
      setSession((prev) => (prev === undefined ? immediate : prev));
      const cached = readMeCache(immediate.user?.id);
      if (cached) setProfile(cached);
    } else if (!stored?.access_token) {
      setSession((prev) => (prev === undefined ? null : prev));
    }

    const { data: listener } = client.auth.onAuthStateChange((event, newSession) => {
      if (cancelled) return;
      if (newSession) {
        setSession((prev) => (
          prev?.access_token === newSession.access_token ? prev : newSession
        ));
        const cached = readMeCache(newSession.user?.id);
        if (cached) setProfile(cached);
        return;
      }
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setProfile(null);
        clearMeCache();
        clearInboxThreadsCache();
        clearMoonJourneyCache();
      }
    });

    resolveBrowserSession(client).then((s) => {
      if (cancelled) return;
      setSession((prev) => {
        if (!s) return prev === undefined ? null : prev;
        if (prev?.access_token === s.access_token) return prev;
        return s;
      });
      if (s?.user?.id) {
        const cached = readMeCache(s.user.id);
        if (cached) setProfile(cached);
      }
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  // Fetch /api/me when session changes
  useEffect(() => {
    if (session === undefined) return;
    if (!session?.access_token) {
      setProfile(null);
      return;
    }
    const userId = session.user?.id;
    const cached = userId ? readMeCache(userId) : null;
    if (cached) setProfile(cached);

    const token = session.access_token;
    let cancelled = false;
    fetch('/api/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        if (r.status === 401) {
          const body = await r.json().catch(() => ({}));
          if (body.code === 'NO_PROFILE') {
            const client = getBrowserClient();
            client?.auth.signOut();
          }
          clearMeCache();
        clearInboxThreadsCache();
        clearMoonJourneyCache();
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((data) => {
        if (!cancelled) {
          setProfile(data || null);
          if (data && userId) writeMeCache(userId, data);
        }
      })
      .catch(() => {
        if (!cancelled && !cached) setProfile(null);
      });
    return () => { cancelled = true; };
  }, [session?.access_token, session?.user?.id]);

  const signIn = async (email, password) => {
    const client = getBrowserClient();
    return client.auth.signInWithPassword({ email, password });
  };

  const signUp = async (email, password, displayName) => {
    const client = getBrowserClient();
    const origin = getSiteOrigin();
    const redirectTo = origin ? `${origin}/auth/confirm` : undefined;
    const result = await client.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: redirectTo,
      },
    });
    return result;
  };

  const signOut = async () => {
    const client = getBrowserClient();
    await client.auth.signOut();
    clearMeCache();
    clearInboxThreadsCache();
    clearMoonJourneyCache();
  };

  const resetPassword = async (email, redirectPath) => {
    const client = getBrowserClient();
    const origin = getSiteOrigin();
    let redirectTo;
    if (origin) {
      const base = `${origin}/auth/reset-password`;
      redirectTo = redirectPath
        ? `${base}?redirect=${encodeURIComponent(redirectPath)}`
        : base;
    }
    return client.auth.resetPasswordForEmail(email, { redirectTo });
  };

  const displayName = session ? resolveDisplayName(session, profile) : null;

  return (
    <AuthContext.Provider value={{ session, profile, displayName, signIn, signUp, signOut, resetPassword, loading: session === undefined }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
