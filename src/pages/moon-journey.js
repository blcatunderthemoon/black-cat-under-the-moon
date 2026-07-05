/**
 * /moon-journey — Moon Journey rules & level requirements
 */

import AppShell from '../components/AppShell.js';
import AppHeaderAuth from '../components/AppHeaderAuth.js';
import ForumHeaderLogo from '../components/ForumHeaderLogo.js';
import MoonJourneyGuide from '../components/MoonJourneyGuide.js';
import SeoHead from '../components/SeoHead.js';
import PixelMoonIcon from '../components/PixelMoonIcon.js';

export default function MoonJourneyPage() {
  return (
    <>
      <SeoHead
        title="月光旅程"
        description="黑貓樹洞月光旅程玩法說明：等級稱號、EXP 獲取方式、升級門檻與每日打卡規則。"
        path="/moon-journey"
      />
      <AppShell
        headerBrand={<ForumHeaderLogo />}
        headerVariant="forum"
        breadcrumbs={[
          { label: '黑貓樹洞', href: '/forum' },
          { label: '月光旅程' },
        ]}
        maxWidth="720px"
        warmBackground
        showStarfield={false}
        pageClassName="app-page--forum app-page--moon-journey"
        nav={<AppHeaderAuth redirectPath="/moon-journey" />}
      >
        <header className="moon-journey-page-intro">
          <div className="moon-journey-page-intro__icon" aria-hidden="true">
            <PixelMoonIcon size={40} />
          </div>
          <p className="moon-journey-page-intro__lead">
            參與黑貓樹洞，累積月光經驗，踏上七段月夜成長之路。
          </p>
        </header>

        <MoonJourneyGuide />
      </AppShell>
    </>
  );
}
