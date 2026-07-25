/**
 * Safety notice for gatherings — open by default, still collapsible.
 */

import { useState } from 'react';

export default function GatheringSafetyNotice({ defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      className="gathering-safety"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="gathering-safety__summary">
        <span className="gathering-safety__title">安全小提示</span>
        <span className="gathering-safety__hint" aria-hidden="true">
          {open ? '收起' : '展開'}
        </span>
      </summary>
      <ul className="gathering-safety__list">
        <li>本平台只係中介渠道，唔係活動主辦方；聚會由用戶自行發起同進行。</li>
        <li>詳細地址／語音連結只會喺獲批准後先顯示。</li>
        <li>線下見面請揀公眾地方，並讓可信朋友知悉行程；請自行查證對方同評估風險。</li>
        <li>聚會期間發生嘅任何事，後果由相關用戶自行承擔；平台不作後果承擔。</li>
        <li>遇到不當行為，可隨時舉報或封鎖對方；達到門檻會自動隱藏並通知守護者。</li>
      </ul>
    </details>
  );
}
