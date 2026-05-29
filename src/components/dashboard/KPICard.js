import styles from '../../styles/dashboard/KPICard.module.css';

export default function KPICard({ label, value, unit, icon, delta, sub }) {
  const isPositive = delta && !delta.startsWith('-');

  return (
    <div className={styles.card}>
      {icon && <span className={styles.icon}>{icon}</span>}
      <div className={styles.label}>{label}</div>
      <div className={styles.valueRow}>
        <span className={styles.value}>{value ?? '—'}</span>
        {unit && <span className={styles.unit}>{unit}</span>}
        {delta && (
          <span className={`${styles.delta} ${isPositive ? styles.positive : styles.negative}`}>
            {delta}
          </span>
        )}
      </div>
      {sub && <div className={styles.sub}>{sub}</div>}
    </div>
  );
}
