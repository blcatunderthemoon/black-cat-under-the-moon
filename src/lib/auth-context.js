/**
 * src/lib/auth-context.js
 * React context for client-side auth state.
 * Manages the Supabase session on the client.
 */

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import { resolveBrowserSession, readStoredAuthSession, sessionFromStored } from './browser-session.js';
import { resolveDisplayName } from './display-name.js';
import { readMeCache, writeMeCache, clearMeCache, ME_CACHE_KEY, PROFILE_UPDATED_EVENT } from './me-cache.js';
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
  const router = useRouter();
  const [session, setSession] = useState(undefined); // undefined = loading
  const [profile, setProfile] = useState(null);
  const [profileHydrated, setProfileHydrated] = useState(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const refreshProfile = useCallback(async () => {
    const s = sessionRef.current;
    if (!s?.access_token || !s?.user?.id) return null;
    const userId = s.user.id;
    try {
      const r = await fetch('/api/me', {
        headers: { Authorization: `Bearer ${s.access_token}` },
        cache: 'no-store',
      });
      if (r.status === 401) {
        clearMeCache();
        clearInboxThreadsCache();
        clearMoonJourneyCache();
        return null;
      }
      if (!r.ok) return null;
      const data = await r.json();
      setProfile(data);
      writeMeCache(userId, data);
      return data;
    } catch {
      return null;
    }
  }, []);

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
    if (session === undefined) {
      setProfileHydrated(false);
      return;
    }
    if (!session?.access_token) {
      setProfile(null);
      setProfileHydrated(true);
      return;
    }
    const userId = session.user?.id;
    const cached = userId ? readMeCache(userId) : null;
    if (cached) setProfile(cached);

    const token = session.access_token;
    let cancelled = false;
    setProfileHydrated(false);
    fetch('/api/me', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
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
      })
      .finally(() => {
        if (!cancelled) setProfileHydrated(true);
      });
    return () => { cancelled = true; };
  }, [session?.access_token, session?.user?.id]);

  // Revalidate profile after in-app navigation (e.g. account → inbox) and tab focus.
  useEffect(() => {
    if (!session?.access_token) return;

    const onRoute = () => { refreshProfile(); };
    const onVisible = () => {
      if (document.visibilityState && document.visibilityState !== 'visible') return;
      refreshProfile();
    };

    router.events.on('routeChangeComplete', onRoute);
    window.addEventListener('focus', onVisible);
    window.addEventListener('pageshow', onVisible);
    return () => {
      router.events.off('routeChangeComplete', onRoute);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('pageshow', onVisible);
    };
  }, [session?.access_token, router.events, refreshProfile]);

  // Keep headers in sync when profile cache updates (account rename, other tabs).
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const applyCachedProfile = (userId, data) => {
      if (!userId || userId !== sessionRef.current?.user?.id || !data) return;
      setProfile(data);
    };

    const onProfileUpdated = (e) => {
      const { userId, data } = e.detail || {};
      applyCachedProfile(userId, data);
    };

    const onStorage = (e) => {
      if (e.key !== ME_CACHE_KEY || !e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue);
        applyCachedProfile(parsed?.userId, parsed?.data);
      } catch {
        /* ignore */
      }
    };

    window.addEventListener(PROFILE_UPDATED_EVENT, onProfileUpdated);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(PROFILE_UPDATED_EVENT, onProfileUpdated);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

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

  const meData = profile ?? (session?.user?.id ? readMeCache(session.user.id) : null);
  const displayName = session ? resolveDisplayName(session, meData) : null;

  return (
    <AuthContext.Provider value={{ session, profile, profileHydrated, displayName, refreshProfile, signIn, signUp, signOut, resetPassword, loading: session === undefined }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
