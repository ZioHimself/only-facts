import styles from '@/app/styles/dashboard.module.css';

interface ServerLogsPanelProps {
  readonly isOpen: boolean;
  readonly logs: readonly string[];
  readonly onClose: () => void;
}

export function ServerLogsPanel({ isOpen, logs, onClose }: ServerLogsPanelProps) {
  return (
    <aside
      className={`${styles.serverLogsPanel} ${isOpen ? styles.serverLogsPanelOpen : ''}`}
      aria-hidden={!isOpen}
    >
      <header className={styles.serverLogsHeader}>
        <div>
          <div className={styles.serverLogsTitle}>Raw Server Logs</div>
          <div className={styles.serverLogsSubtitle}>Live ingestion and pipeline events</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={styles.serverLogsClose}
          aria-label="Close logs panel"
        >
          ×
        </button>
      </header>
      <pre className={styles.serverLogsOutput}>{logs.join('\n')}</pre>
    </aside>
  );
}
