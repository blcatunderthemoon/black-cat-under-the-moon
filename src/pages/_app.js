import '../styles/dashboard/globals.css';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';

function DashboardAuthGate({ children }) {
  const [authed, setAuthed] = useState(false);
  const [secured, setSecured] = useState(null); // null = checking
  const [keyInput, setKeyInput] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Ask the server whether DASHBOARD_SECRET is configured
    fetch('/api/dashboard/ping')
      .then((r) => r.json())
      .then(({ secured: s }) => {
        if (!s) {
          // No secret set — dev mode, bypass gate
          setSecured(false);
          setAuthed(true);
        } else {
          setSecured(true);
          if (sessionStorage.getItem('dashKey')) setAuthed(true);
        }
      })
      .catch(() => {
        // If ping fails, still check sessionStorage
        setSecured(true);
        if (sessionStorage.getItem('dashKey')) setAuthed(true);
      });
  }, []);

  if (secured === null) return null; // loading
  if (authed) return children;

  function handleSubmit(e) {
    e.preventDefault();
    if (!keyInput.trim()) { setError('請輸入 Dashboard 金鑰。'); return; }
    sessionStorage.setItem('dashKey', keyInput.trim());
    setAuthed(true);
  }

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#050914' }}>
      <form onSubmit={handleSubmit} style={{ background:'#0b0d22', border:'1px solid #1d2055', borderRadius:12, padding:40, minWidth:320, display:'flex', flexDirection:'column', gap:16 }}>
        <h2 style={{ color:'#bd93f9', margin:0, fontFamily:'Noto Sans TC, sans-serif' }}>Dashboard 金鑰</h2>
        <input
          type="password"
          value={keyInput}
          onChange={e => setKeyInput(e.target.value)}
          placeholder="輸入 DASHBOARD_SECRET"
          autoFocus
          style={{ padding:'10px 14px', borderRadius:8, border:'1px solid #1d2055', background:'#050914', color:'#f0ebd8', fontSize:14, outline:'none' }}
        />
        {error && <p style={{ color:'#ff6b9d', margin:0, fontSize:13 }}>{error}</p>}
        <button type="submit" style={{ padding:'10px 0', borderRadius:8, background:'#7c5cfc', color:'#fff', border:'none', cursor:'pointer', fontWeight:600, fontSize:14 }}>
          進入 Dashboard
        </button>
      </form>
    </div>
  );
}

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const isDashboard = router.pathname.startsWith('/dashboard');

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>
      {isDashboard ? (
        <DashboardAuthGate>
          <Component {...pageProps} />
        </DashboardAuthGate>
      ) : (
        <Component {...pageProps} />
      )}
    </>
  );
}

