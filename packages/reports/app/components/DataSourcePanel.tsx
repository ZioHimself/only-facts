import styles from '@/app/styles/dashboard.module.css';

export type DataSourceType = 'db_url' | 'json' | 'yaml' | 'api';

interface DataSourcePanelProps {
  readonly isOpen: boolean;
  readonly sourceType: DataSourceType;
  readonly dbUrl: string;
  readonly apiUrl: string;
  readonly jsonFileName: string;
  readonly yamlFileName: string;
  readonly onSourceTypeChange: (nextType: DataSourceType) => void;
  readonly onDbUrlChange: (nextValue: string) => void;
  readonly onApiUrlChange: (nextValue: string) => void;
  readonly onJsonFileChange: (nextName: string) => void;
  readonly onYamlFileChange: (nextName: string) => void;
  readonly mockDataEnabled: boolean;
  readonly mockDataYaml: string;
  readonly onToggleMockData: () => void;
  readonly externalSourcesDisabled: boolean;
  readonly onClose: () => void;
}

const sourceLabels: Record<DataSourceType, string> = {
  db_url: 'DB URL',
  json: 'Load JSON',
  yaml: 'Load YAML',
  api: 'API',
};

export function DataSourcePanel({
  isOpen,
  sourceType,
  dbUrl,
  apiUrl,
  jsonFileName,
  yamlFileName,
  onSourceTypeChange,
  onDbUrlChange,
  onApiUrlChange,
  onJsonFileChange,
  onYamlFileChange,
  mockDataEnabled,
  mockDataYaml,
  onToggleMockData,
  externalSourcesDisabled,
  onClose,
}: DataSourcePanelProps) {
  return (
    <aside
      className={`${styles.dataSourcePanel} ${isOpen ? styles.dataSourcePanelOpen : ''}`}
      aria-hidden={!isOpen}
    >
      <header className={styles.dataSourceHeader}>
        <div>
          <div className={styles.dataSourceTitle}>Data Source Settings</div>
          <div className={styles.dataSourceSubtitle}>Standardize inbound intelligence data</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={styles.dataSourceClose}
          aria-label="Close data settings"
        >
          ×
        </button>
      </header>

      <div className={styles.dataSourceOptionGrid}>
        {(Object.keys(sourceLabels) as DataSourceType[]).map((key) => (
          <button
            key={key}
            type="button"
            className={`${styles.dataSourceOption} ${sourceType === key ? styles.dataSourceOptionActive : ''}`}
            onClick={() => onSourceTypeChange(key)}
            disabled={externalSourcesDisabled}
          >
            {sourceLabels[key]}
          </button>
        ))}
      </div>

      {externalSourcesDisabled ? (
        <p className={styles.dataSourceHint}>
          Mock mode is active. Turn OFF mock data to enable DB/API/JSON/YAML sources.
        </p>
      ) : null}

      {sourceType === 'db_url' ? (
        <label className={styles.dataSourceField}>
          <span className={styles.dataSourceLabel}>Database URL</span>
          <input
            className={styles.dataSourceInput}
            type="url"
            value={dbUrl}
            onChange={(event) => onDbUrlChange(event.target.value)}
            placeholder="postgresql://user:password@host:5432/database"
            disabled={externalSourcesDisabled}
          />
        </label>
      ) : null}

      {sourceType === 'api' ? (
        <label className={styles.dataSourceField}>
          <span className={styles.dataSourceLabel}>API Endpoint</span>
          <input
            className={styles.dataSourceInput}
            type="url"
            value={apiUrl}
            onChange={(event) => onApiUrlChange(event.target.value)}
            placeholder="https://api.example.com/intelligence/metrics"
            disabled={externalSourcesDisabled}
          />
        </label>
      ) : null}

      {sourceType === 'json' ? (
        <label className={styles.dataSourceField}>
          <span className={styles.dataSourceLabel}>JSON File</span>
          <input
            className={styles.dataSourceFile}
            type="file"
            accept=".json,application/json"
            onChange={(event) => onJsonFileChange(event.target.files?.[0]?.name ?? '')}
            disabled={externalSourcesDisabled}
          />
          <span className={styles.dataSourceHint}>{jsonFileName || 'No JSON file selected'}</span>
        </label>
      ) : null}

      {sourceType === 'yaml' ? (
        <label className={styles.dataSourceField}>
          <span className={styles.dataSourceLabel}>YAML File</span>
          <input
            className={styles.dataSourceFile}
            type="file"
            accept=".yaml,.yml,text/yaml"
            onChange={(event) => onYamlFileChange(event.target.files?.[0]?.name ?? '')}
            disabled={externalSourcesDisabled}
          />
          <span className={styles.dataSourceHint}>{yamlFileName || 'No YAML file selected'}</span>
        </label>
      ) : null}

      <section className={styles.mockDataBlock} aria-label="Mock data control">
        <div className={styles.mockDataHeaderRow}>
          <span className={styles.dataSourceLabel}>mock-data.yaml</span>
          <button
            type="button"
            className={`${styles.mockToggle} ${mockDataEnabled ? styles.mockToggleOn : styles.mockToggleOff}`}
            onClick={onToggleMockData}
          >
            {mockDataEnabled ? 'Mock Data ON' : 'Mock Data OFF'}
          </button>
        </div>
        <textarea className={styles.mockYamlArea} readOnly value={mockDataYaml} />
      </section>
    </aside>
  );
}
