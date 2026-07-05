import { useEffect, useState } from 'react';

/** Avoid SSR/hydration blank flash on auth-gated client pages. */
export function useClientReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  return ready;
}
