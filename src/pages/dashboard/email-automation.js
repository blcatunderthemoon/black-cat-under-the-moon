import Layout from '../../components/dashboard/Layout';
import { AdminApiContext } from '../../lib/admin-api-context.js';
import { dashFetch } from '../../lib/dashboard-fetch.js';
import { EmailAutomationPanel } from '../../components/admin/EmailAutomationPanel.js';

export default function EmailAutomationPage() {
  return (
    <Layout pageTitle="郵件自動化" breadcrumb="儀表板 / 郵件自動化">
      <AdminApiContext.Provider value={dashFetch}>
        <EmailAutomationPanel />
      </AdminApiContext.Provider>
    </Layout>
  );
}
