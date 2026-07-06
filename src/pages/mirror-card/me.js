/**
 * /mirror-card/me — redirect to own public mirror card (or account if none)
 */

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../lib/auth-context.js';
import PageLoadingShell from '../../components/PageLoadingShell.js';

export default function MirrorCardMePage() {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/login?redirect=/mirror-card/me');
      return;
    }

    let cancelled = false;
    fetch('/api/mirror-card/me', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const slug = data?.card?.public_slug;
        if (slug) router.replace(`/mirror-card/${slug}`);
        else router.replace('/account');
      })
      .catch(() => {
        if (!cancelled) router.replace('/account');
      });

    return () => {
      cancelled = true;
    };
  }, [session, loading, router]);

  return <PageLoadingShell label="載入中…" pageClassName="moon-page-loading" />;
}
