import styles from '../../styles/dashboard/ChartCard.module.css';

export default function ChartCard({ title, subtitle, children, actions, loading }) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <span className={styles.title}>{title}</span>
          {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
      <div className={styles.body}>
        {loading ? (
          <div className={styles.loading}>
            <div className={styles.loadingDot} />
            <div className={styles.loadingDot} />
            <div className={styles.loadingDot} />
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
