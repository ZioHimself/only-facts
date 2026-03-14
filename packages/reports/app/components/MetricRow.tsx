import styles from '@/app/styles/dashboard.module.css';
import type { MarkerTone } from '@/app/data/dashboardData';

interface MetricRowProps {
  readonly label: string;
  readonly value: string;
  readonly percentage?: string;
  readonly markerTone?: MarkerTone;
}

export function MetricRow({ label, value, percentage, markerTone }: MetricRowProps) {
  return (
    <div className={styles.metricRow}>
      <div className={styles.metricLabelGroup}>
        {markerTone ? <span className={styles[`marker_${markerTone}`]} aria-hidden="true" /> : null}
        <span className={styles.metricLabel}>{label}</span>
      </div>
      <div className={styles.metricValueGroup}>
        <span className={styles.metricValue}>{value}</span>
        {percentage ? <span className={styles.metricPercent}>({percentage})</span> : null}
      </div>
    </div>
  );
}
