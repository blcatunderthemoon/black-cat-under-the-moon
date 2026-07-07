/**
 * /dashboard/forum — station moderation queue (DASHBOARD_SECRET)
 */

import Head from 'next/head';
import Layout from '../../../components/dashboard/Layout';
import ForumDashboardNav from '../../../components/dashboard/ForumDashboardNav';
import ForumModQueuePanel from '../../../components/ForumModQueuePanel';

export default function DashboardForumPage() {
  return (
    <Layout pageTitle="月光圍爐治理" breadcrumb="儀表板 / 月光圍爐 / 檢舉佇列">
      <Head>
        <title>月光圍爐治理 · Dashboard</title>
      </Head>
      <ForumDashboardNav />
      <ForumModQueuePanel authMode="dashboard" />
    </Layout>
  );
}
