import Layout from '../../components/dashboard/Layout';
import ForumDashboardNav from '../../components/dashboard/ForumDashboardNav';
import ForumMonitorPanel from '../../components/forum-admin/ForumMonitorPanel';
import { dashFetch } from '../../lib/dashboard-fetch.js';

export default function ForumMonitorPage() {
  return (
    <Layout pageTitle="論壇內容監控" breadcrumb="儀表板 / 月光圍爐 / 內容監控">
      <ForumDashboardNav />
      <ForumMonitorPanel apiFetch={dashFetch} />
    </Layout>
  );
}
