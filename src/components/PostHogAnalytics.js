import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Script from 'next/script';
import { useAuth } from '../lib/auth-context.js';
import { isPostHogEnabled } from '../lib/posthog-config.js';
import { pageviewEventProperties } from '../lib/posthog-page-context.js';

function capturePageview(path, surface) {
  if (typeof window === 'undefined' || !window.posthog?.capture) return;
  window.posthog.capture('$pageview', pageviewEventProperties(path || window.location.pathname, { surface: surface || 'next' }));
}

export function PostHogPageviews() {
  const router = useRouter();

  useEffect(() => {
    if (!isPostHogEnabled()) return undefined;

    const onRoute = (url) => capturePageview(url, 'next');

    router.events.on('routeChangeComplete', onRoute);
    return () => router.events.off('routeChangeComplete', onRoute);
  }, [router.events]);

  return null;
}

export function PostHogIdentify() {
  const { session, profile: me } = useAuth();

  useEffect(() => {
    if (!isPostHogEnabled() || !window.posthog) return;

    if (!session?.user?.id) {
      if (typeof window.posthog.reset === 'function') {
        window.posthog.reset();
      }
      return;
    }

    const profile = me?.profile;
    window.posthog.identify(session.user.id, {
      email: session.user.email || undefined,
      display_name: profile?.display_name || undefined,
      subscription_tier: profile?.subscription_tier || 'free',
      mirror_type: me?.mirror_card?.mirror_type || undefined,
    });
  }, [
    session?.user?.id,
    session?.user?.email,
    me?.profile?.display_name,
    me?.profile?.subscription_tier,
    me?.mirror_card?.mirror_type,
  ]);

  return null;
}

export default function PostHogAnalytics() {
  const [clientReady, setClientReady] = useState(false);

  useEffect(() => {
    setClientReady(true);
  }, []);

  if (!isPostHogEnabled() || !clientReady) return null;

  return (
    <>
      <Script src="/js/posthog-page-context.js" strategy="beforeInteractive" />
      <Script src="/js/posthog-init.js" strategy="afterInteractive" />
      <PostHogPageviews />
      <PostHogIdentify />
    </>
  );
}
