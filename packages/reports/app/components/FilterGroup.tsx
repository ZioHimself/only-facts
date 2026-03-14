import styles from '@/app/styles/dashboard.module.css';

interface FilterGroupProps {
  readonly label: string;
  readonly value: string;
  readonly options: readonly string[];
  readonly onChange: (nextValue: string) => void;
}

export function FilterGroup({ label, value, options, onChange }: FilterGroupProps) {
  return (
    <div className={styles.filterGroup}>
      <div className={styles.filterLabel}>{label}</div>
      <label className={styles.filterSelectWrap}>
        <select
          className={styles.filterSelect}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={`${label} selector`}
        >
          {options.map((option) => (
            <option key={`${label}-${option}`} value={option}>
              {option}
            </option>
          ))}
        </select>
        <span className={styles.chevron} aria-hidden="true">
          ▼
        </span>
      </label>
    </div>
  );
}
