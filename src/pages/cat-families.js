/**
 * /cat-families — Intro to the four Mirror Mode cat families
 */

import AppShell from '../components/AppShell.js';
import AppHeaderAuth from '../components/AppHeaderAuth.js';
import CatFamiliesGuide from '../components/CatFamiliesGuide.js';
import SeoHead from '../components/SeoHead.js';
import PixelMixedLabel from '../components/PixelMixedLabel.js';

export default function CatFamiliesPage() {
  return (
    <>
      <SeoHead
        title="四大貓家族"
        description="認識 Mirror Mode 四大貓家族與六種戀愛需求：自主、確認、共鳴、穩定、表達、承諾。探索你的靈魂鏡像屬於哪一族。"
        path="/cat-families"
      />
      <AppShell
        title="四大貓家族"
        headerVariant="account"
        backHref="/index.html"
        maxWidth="720px"
        pageClassName="app-page--cat-families"
        nav={<AppHeaderAuth redirectPath="/cat-families" />}
      >
        <header className="cat-families-intro">
          <p className="cat-families-intro__lead">
            <PixelMixedLabel
              text="每個靈魂都帶著一種貓的氣質"
              zhClass="cat-families-intro__zh"
              enClass="cat-families-intro__en"
            />
          </p>
          <p className="cat-families-intro__hook">
            <PixelMixedLabel
              text="你屬於哪一族？"
              zhClass="cat-families-intro__zh cat-families-intro__zh--hook"
              enClass="cat-families-intro__en cat-families-intro__en--hook"
            />
          </p>
          <p className="cat-families-intro__sub">
            戀愛裡有人需要空間、有人需要被肯定、有人需要被懂得、有人需要可預期的安心。
            Mirror Mode 會量出你的需求光譜，再凝結成專屬的靈魂鏡像卡——看看哪一族最像你。
          </p>
        </header>

        <CatFamiliesGuide />
      </AppShell>
    </>
  );
}
