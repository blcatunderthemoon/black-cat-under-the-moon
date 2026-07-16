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
        <li>詳細地址／語音連結只會喺獲批准後先顯示。</li>
        <li>線下見面請揀公眾地方，並讓可信朋友知悉行程。</li>
        <li>平台唔係活動主辦方；主辦人與參加者請自行評估風險。</li>
      </ul>
    </details>
  );
}
