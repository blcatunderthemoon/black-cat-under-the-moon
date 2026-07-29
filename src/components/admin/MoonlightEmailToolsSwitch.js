/**
 * Switch between Thank-you ack emails and invitation outreach emails.
 */

import { useState } from 'react';
import MoonlightApplicationAckPanel from './MoonlightApplicationAckPanel.js';
import MoonlightInviteEmailPanel from './MoonlightInviteEmailPanel.js';

const TABS = [
  { id: 'ack', label: 'Thank you 確認信' },
  { id: 'invite', label: '邀請電郵' },
];

export default function MoonlightEmailToolsSwitch({ variant = 'card' }) {
  const [tab, setTab] = useState('ack');

  return (
    <div className="mi-email-tools">
      <div className="mi-email-tools__switch" role="tablist" aria-label="電郵工具">
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`mi-email-tab-${item.id}`}
              aria-selected={active}
              aria-controls={`mi-email-panel-${item.id}`}
              tabIndex={active ? 0 : -1}
              className={`mi-email-tools__btn${active ? ' is-active' : ''}`}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div
        id="mi-email-panel-ack"
        role="tabpanel"
        aria-labelledby="mi-email-tab-ack"
        hidden={tab !== 'ack'}
        className="mi-email-tools__panel"
      >
        {tab === 'ack' && <MoonlightApplicationAckPanel variant={variant} />}
      </div>

      <div
        id="mi-email-panel-invite"
        role="tabpanel"
        aria-labelledby="mi-email-tab-invite"
        hidden={tab !== 'invite'}
        className="mi-email-tools__panel"
      >
        {tab === 'invite' && <MoonlightInviteEmailPanel variant={variant} />}
      </div>
    </div>
  );
}
