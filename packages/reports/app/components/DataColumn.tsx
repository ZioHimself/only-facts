import styles from '@/app/styles/dashboard.module.css';
import type { DataColumnData } from '@/app/data/dashboardData';
import { MetricRow } from '@/app/components/MetricRow';

interface DataColumnProps {
  readonly column: DataColumnData;
}

export function DataColumn({ column }: DataColumnProps) {
  return (
    <section className={styles.dataColumn} aria-label={column.title}>
      <header className={styles.columnHeading}>{column.title}</header>
      {column.sections.map((section) => (
        <div key={`${column.title}-${section.heading ?? 'base'}`} className={styles.metricSection}>
          {section.heading ? <h3 className={styles.sectionHeading}>{section.heading}</h3> : null}
          <div className={styles.metricList}>
            {section.rows.map((row) => (
              <MetricRow
                key={`${column.title}-${section.heading ?? 'base'}-${row.label}`}
                label={row.label}
                value={row.value}
                percentage={row.percentage}
                markerTone={row.markerTone}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
