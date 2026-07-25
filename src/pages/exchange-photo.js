/**

 * /exchange-photo — upload, respond, or view exchanged photos

 */



import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../lib/auth-context.js';
import AppShell from '../components/AppShell.js';
import AppHeaderAuth from '../components/AppHeaderAuth.js';
import { UiCameraIcon } from '../components/UiIcons.js';

import SeoHead from '../components/SeoHead.js';

import ExchangePhotoUpload from '../components/ExchangePhotoUpload.js';
import PhotoExchangePairView from '../components/PhotoExchangePairView.js';
import PhotoExchangeMirrorCardBtn from '../components/PhotoExchangeMirrorCardBtn.js';
import PhotoExchangeCompletedShell from '../components/PhotoExchangeCompletedShell.js';
import MoonLoading from '../components/MoonLoading.js';
import MediaCaptureGuard from '../components/MediaCaptureGuard.js';

import { isPremiumUser, MOONLIGHT_PASSPORT_BRAND } from '../lib/premium.js';



function safeRedirectPath(raw) {

  const path = String(raw || '').trim();

  if (!path.startsWith('/') || path.startsWith('//')) return null;

  return path;

}



function safeExchangeAction(raw) {

  const action = String(raw || '').trim();

  return action === 'request' || action === 'respond' ? action : null;

}



function safeSlug(raw) {

  const slug = String(raw || '').trim();

  return /^[A-Za-z0-9_-]+$/.test(slug) ? slug : null;

}



function buildConfirmReturnHref(redirectPath, action) {

  if (!redirectPath || !action) return redirectPath;

  const sep = redirectPath.includes('?') ? '&' : '?';

  return `${redirectPath}${sep}exchange_confirm=${encodeURIComponent(action)}`;

}



export default function ExchangePhotoPage() {

  const { session, profile, loading } = useAuth();

  const router = useRouter();

  const [exchangePhotoUrl, setExchangePhotoUrl] = useState('');

  const [photoExchangeQuota, setPhotoExchangeQuota] = useState(null);

  const [dataLoading, setDataLoading] = useState(true);

  const [exchangeLoading, setExchangeLoading] = useState(false);

  const [exchangeDetail, setExchangeDetail] = useState(null);

  const [savedNotice, setSavedNotice] = useState(false);

  const [respondBusy, setRespondBusy] = useState(false);

  const [respondError, setRespondError] = useState('');

  const [respondDone, setRespondDone] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [revealedPhoto, setRevealedPhoto] = useState('');
  const [revealedMyPhoto, setRevealedMyPhoto] = useState('');

  const [revealedDays, setRevealedDays] = useState(0);
  const [revealedExpiresAt, setRevealedExpiresAt] = useState(null);

  const [otherPartyName, setOtherPartyName] = useState('');
  const [viewerName, setViewerName] = useState('你');



  const redirect = safeRedirectPath(router.query.redirect);

  const action = safeExchangeAction(router.query.action);

  const exchangeId = String(router.query.exchange || '').trim() || null;

  const requesterSlug = safeSlug(router.query.slug);

  const tier = profile?.profile?.subscription_tier || 'free';

  const isPremium = isPremiumUser(profile);



  const otherSlug = exchangeDetail?.other_party_slug || requesterSlug;

  const mirrorCardHref = otherSlug

    ? `/mirror-card/${encodeURIComponent(otherSlug)}`

    : null;



  const isViewMode = !!(revealedPhoto || exchangeDetail?.other_party_photo_url);

  const photoToShow = revealedPhoto || exchangeDetail?.other_party_photo_url || '';
  const myPhotoToShow = revealedMyPhoto || exchangeDetail?.viewer_photo_url || exchangePhotoUrl || '';

  const daysToShow = revealedDays || exchangeDetail?.days_remaining || 0;
  const expiresAt = revealedExpiresAt || exchangeDetail?.expires_at || null;

  const displayName = otherPartyName || exchangeDetail?.other_party_name || '對方';
  const myDisplayName = viewerName || exchangeDetail?.viewer_name || profile?.profile?.display_name || '你';



  const isRespondMode = !!exchangeId

    && !isViewMode

    && (exchangeDetail?.can_respond || (!exchangeDetail && action === 'respond'));

  const isWaitingMode = exchangeDetail?.status === 'pending' && exchangeDetail?.role === 'requester';



  async function handleCompleteExchange() {

    if (!session?.access_token || !exchangeId || respondBusy) return;

    setRespondBusy(true);

    setRespondError('');

    try {

      const r = await fetch('/api/photo-exchange/respond', {

        method: 'POST',

        headers: {

          'Content-Type': 'application/json',

          Authorization: `Bearer ${session.access_token}`,

        },

        body: JSON.stringify({

          exchange_id: exchangeId,

          photo_url: exchangePhotoUrl || undefined,

        }),

      });

      const result = await r.json().catch(() => ({}));

      if (!r.ok) {

        setRespondError(result.error || '完成交換失敗，請稍後再試。');

        return;

      }

      if (result.other_party_photo_url) {

        setRevealedPhoto(result.other_party_photo_url);

        setRevealedDays(result.days_remaining || 0);
        setRevealedExpiresAt(result.expires_at || null);

      }

      if (result.viewer_photo_url) {

        setRevealedMyPhoto(result.viewer_photo_url);

      }

      setRespondDone(true);
      setJustCompleted(true);
    } catch {
      setRespondError('網路錯誤，請重試。');

    } finally {

      setRespondBusy(false);

    }

  }



  useEffect(() => {

    if (!loading && !session) {

      const params = new URLSearchParams();

      if (redirect) params.set('redirect', redirect);

      if (action) params.set('action', action);

      if (exchangeId) params.set('exchange', exchangeId);

      if (requesterSlug) params.set('slug', requesterSlug);

      const qs = params.toString();

      const target = qs ? `/exchange-photo?${qs}` : '/exchange-photo';

      router.replace(`/login?redirect=${encodeURIComponent(target)}`);

    }

  }, [session, loading, router, redirect, action, exchangeId, requesterSlug]);



  useEffect(() => {

    if (!session?.access_token) return;

    setDataLoading(true);

    fetch('/api/me', {

      headers: { Authorization: `Bearer ${session.access_token}` },

    })

      .then((r) => (r.ok ? r.json() : null))

      .then((data) => {

        if (!data) return;

        setExchangePhotoUrl(data.profile?.exchange_photo_url || '');

        setPhotoExchangeQuota(data.photo_exchange_quota || null);

      })

      .finally(() => setDataLoading(false));

  }, [session?.access_token]);



  useEffect(() => {

    if (!session?.access_token || !exchangeId) return;

    setExchangeLoading(true);

    fetch(`/api/photo-exchange/${encodeURIComponent(exchangeId)}`, {

      headers: { Authorization: `Bearer ${session.access_token}` },

    })

      .then((r) => (r.ok ? r.json() : null))

      .then((data) => {

        if (!data) return;

        setExchangeDetail(data);

        setOtherPartyName(data.other_party_name || '對方');

        if (data.viewer_name) setViewerName(data.viewer_name);

        if (data.other_party_photo_url) {

          setRevealedPhoto(data.other_party_photo_url);

          setRevealedDays(data.days_remaining || 0);
          setRevealedExpiresAt(data.expires_at || null);

          setRespondDone(true);

        }

        if (data.viewer_photo_url) {

          setRevealedMyPhoto(data.viewer_photo_url);

        }

      })

      .finally(() => setExchangeLoading(false));

  }, [session?.access_token, exchangeId]);



  function handleSaved(url) {

    setExchangePhotoUrl(url || '');

    setSavedNotice(true);

  }



  const confirmReturnHref = buildConfirmReturnHref(redirect, action);



  const pageTitle = isViewMode

    ? `與 ${displayName} 交換相`

    : isRespondMode

      ? '回應交換相'

      : '交換用相片';



  const pageBooting = loading || !session || (exchangeId && exchangeLoading && !exchangeDetail && !revealedPhoto);



  if (pageBooting) {

    return (

      <AppShell title={pageTitle} headerVariant="account" nav={<AppHeaderAuth redirectPath="/exchange-photo" />}>

        <MoonLoading variant="hero" />

      </AppShell>

    );

  }



  return (

    <>

      <SeoHead title={pageTitle} description="上傳用於 Mirror Card 交換相的真人相片。" path="/exchange-photo" />
      <MediaCaptureGuard />

      <AppShell

        title={pageTitle}

        backHref={redirect || '/index.html'}

        headerVariant="account"

        pageClassName={`app-page--exchange-photo media-capture-guard${isRespondMode ? ' app-page--exchange-photo--respond' : ''}${isViewMode ? ' app-page--exchange-photo--view' : ''}`}

        maxWidth="420px"

        nav={<AppHeaderAuth redirectPath={redirect || '/exchange-photo'} />}

      >

        {isViewMode && photoToShow ? (

          <>

            <PhotoExchangeCompletedShell

              footer={(

                <>

                  {mirrorCardHref && <PhotoExchangeMirrorCardBtn href={mirrorCardHref} />}

                  {redirect && (

                    <Link href={redirect} className="exchange-photo-page__back pixel-link">

                      ← 返回對話

                    </Link>

                  )}

                </>

              )}

            >

              <PhotoExchangePairView

                myPhotoUrl={myPhotoToShow}

                otherPhotoUrl={photoToShow}

                myLabel={myDisplayName}

                otherLabel={displayName}

                daysRemaining={daysToShow}

                expiresAt={expiresAt}

                showSuccessHeader={justCompleted}

              />

            </PhotoExchangeCompletedShell>

          </>

        ) : (

        <section className="exchange-photo-page">

          <header className="exchange-photo-page__header">

            <span className="exchange-photo-page__icon" aria-hidden="true"><UiCameraIcon size={28} /></span>

            <h1 className="exchange-photo-page__title">{pageTitle}</h1>

          </header>



          {isRespondMode && !respondDone && (

            <ol className="exchange-photo-page__steps" aria-label="交換步驟">

              <li className={`exchange-photo-page__step${exchangePhotoUrl ? ' exchange-photo-page__step--done' : ' exchange-photo-page__step--active'}`}>

                <span className="exchange-photo-page__step-num">1</span>

                <span>選擇相片</span>

              </li>

              <li className={`exchange-photo-page__step${exchangePhotoUrl ? ' exchange-photo-page__step--active' : ''}`}>

                <span className="exchange-photo-page__step-num">2</span>

                <span>完成交換</span>

              </li>

            </ol>

          )}



          <div className="exchange-photo-page__hero">

            {isPremium && photoExchangeQuota && !isRespondMode && !isViewMode && (

              <span className="exchange-photo-page__quota-pill">

                本月邀請 {photoExchangeQuota.remaining} / {photoExchangeQuota.limit}

              </span>

            )}

            <p className="exchange-photo-page__intro">

              {isWaitingMode

                  ? `已發送交換邀請，等待 ${displayName} 回傳相片…`

                  : isRespondMode

                    ? '上傳你的真人相片以完成交換。成功後雙方可查看清晰相片 7 日。'

                    : '真人相片用於 Mirror Card 交換。對方回傳時才會扣配額，成功後雙方可查看 7 日。'}

            </p>

            {!isPremium && tier === 'free' && !isRespondMode && !isViewMode && (

              <p className="exchange-photo-page__note">

                可回應交換邀請；發起邀請需 <Link href="/premium" className="pixel-link">{MOONLIGHT_PASSPORT_BRAND}</Link>

              </p>

            )}

          </div>



          {isWaitingMode ? (

            <>

              <div className="photo-exchange-inbox-panel__shell exchange-photo-page__pair-shell">

                <PhotoExchangePairView

                  myPhotoUrl={myPhotoToShow}

                  myLabel={myDisplayName}

                  otherLabel={displayName}

                  otherPlaceholder="等待回傳"

                  otherPlaceholderIcon="⏳"

                  hint={`邀請已發送，等待 ${displayName} 回傳相片…`}

                />

              </div>

            <footer className="exchange-photo-page__footer">

              {redirect && (

                <Link href={redirect} className="exchange-photo-page__back pixel-link">

                  ← 返回對話

                </Link>

              )}

            </footer>

            </>

          ) : (

            <>

              {isRespondMode && !respondDone && exchangeDetail?.blurred_preview_url && (

                <div className="exchange-photo-page__respond-grid">

                  <div className="exchange-photo-page__respond-their">

                    <p className="exchange-photo-page__respond-label">

                      {displayName} 的相片

                    </p>

                    <div className="photo-exchange-panel__photo-wrap photo-exchange-panel__photo-wrap--blur">

                      <img

                        src={exchangeDetail.blurred_preview_url}

                        alt=""

                        aria-hidden="true"

                        className="photo-exchange-panel__photo photo-exchange-panel__photo--blurred"

                        draggable={false}

                      />

                      <div className="photo-exchange-panel__blur-overlay" aria-hidden="true" />

                    </div>

                    <p className="exchange-photo-page__respond-hint pixel-subtitle">

                      上傳你的相片後可查看清晰版本

                    </p>

                  </div>

                  <div className="exchange-photo-page__respond-mine">

                    <p className="exchange-photo-page__respond-label">你的相片</p>

              <div className="exchange-photo-page__body">

                {dataLoading ? (

                  <MoonLoading size={28} />

                ) : (

                  <ExchangePhotoUpload

                    layout="page"

                    accessToken={session.access_token}

                    currentUrl={exchangePhotoUrl}

                    onSaved={handleSaved}

                    hideSelectButton={isRespondMode}

                  />

                )}

              </div>

                  </div>

                </div>

              )}

              {(!isRespondMode || respondDone || !exchangeDetail?.blurred_preview_url) && (

              <div className="exchange-photo-page__body">

                {dataLoading ? (

                  <MoonLoading size={28} />

                ) : (

                  <ExchangePhotoUpload

                    layout="page"

                    accessToken={session.access_token}

                    currentUrl={exchangePhotoUrl}

                    onSaved={handleSaved}

                    hideSelectButton={isRespondMode}

                  />

                )}

              </div>

              )}



              <footer className="exchange-photo-page__footer">

                {isRespondMode ? (

                  <>

                    {respondError && (

                      <p className="pixel-error exchange-photo-page__error" role="alert">

                        {respondError}

                      </p>

                    )}

                    <button

                      type="button"

                      className={`pixel-btn pixel-btn--primary exchange-photo-page__confirm-return${exchangePhotoUrl ? ' exchange-photo-page__confirm-return--ready' : ''}`}

                      onClick={handleCompleteExchange}

                      disabled={!exchangePhotoUrl || respondBusy || dataLoading}

                    >

                      {respondBusy ? '處理中…' : '完成交換'}

                    </button>

                    {redirect && (

                      <Link href={redirect} className="exchange-photo-page__back pixel-link">

                        ← 返回對話

                      </Link>

                    )}

                  </>

                ) : (

                  <>

                    {savedNotice && (

                      <div className="exchange-photo-page__saved-block" role="status">

                        <p className="exchange-photo-page__saved">✓ 相片已儲存</p>

                        {confirmReturnHref && (

                          <p className="exchange-photo-page__saved-hint pixel-subtitle">

                            請返回 Mirror Card 確認後才會發送邀請。

                          </p>

                        )}

                      </div>

                    )}



                    {savedNotice && confirmReturnHref && (

                      <Link href={confirmReturnHref} className="pixel-btn pixel-btn--primary exchange-photo-page__confirm-return">

                        返回確認發送邀請

                      </Link>

                    )}



                    {redirect && (

                      <Link href={redirect} className="exchange-photo-page__back pixel-link">

                        ← {savedNotice && action ? '稍後再確認' : '返回上一頁'}

                      </Link>

                    )}

                  </>

                )}

              </footer>

            </>

          )}

        </section>

        )}

      </AppShell>

    </>

  );

}

