import styles from '../../styles/dashboard/Layout.module.css';
import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout({ children, pageTitle, breadcrumb, headerStats }) {
  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <Sidebar />
      </aside>
      <div className={styles.main}>
        <header className={styles.header}>
          <Header pageTitle={pageTitle} breadcrumb={breadcrumb} stats={headerStats} />
        </header>
        <main className={styles.content}>
          {children}
        </main>
      </div>
    </div>
  );
}
