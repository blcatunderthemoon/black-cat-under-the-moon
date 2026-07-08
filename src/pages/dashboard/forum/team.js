/**
 * /dashboard/forum/team — assign forum_role + topic scope (月光守護者 / 管理員)
 */

import Layout from '../../../components/dashboard/Layout';
import ForumDashboardNav from '../../../components/dashboard/ForumDashboardNav';
import ForumTeamPanel from '../../../components/forum-admin/ForumTeamPanel';
import { dashFetch, handleDashboardUnauthorized } from '../../../lib/dashboard-fetch.js';

export default function ForumTeamPage() {
  return (
    <Layout pageTitle="版主團隊" breadcrumb="儀表板 / 月光圍爐 / 版主團隊">
      <div style={{ color: '#e8e3f5', fontFamily: 'Noto Sans TC, sans-serif' }}>
        <ForumDashboardNav />
        <ForumTeamPanel apiFetch={dashFetch} onUnauthorized={handleDashboardUnauthorized} />
      </div>
    </Layout>
  );
}
