import type { ReactElement } from 'react';
import styles from '@/app/styles/dashboard.module.css';

export type SidebarView = 'dashboard' | 'handlers' | 'reports' | 'operations' | 'network' | 'about';

interface SidebarProps {
  readonly activeView: SidebarView;
  readonly onViewChange: (nextView: SidebarView) => void;
  readonly dataSourceActive: boolean;
  readonly onDataSourceClick: () => void;
}

function LogoMark() {
  return (
    <svg className={styles.logoSvg} viewBox="0 0 96 64" aria-hidden="true">
      <path
        d="M11 39.4c19.8 1.2 44.2 1.2 64 0L48 59 11 39.4Zm11.6-2.1L48 11l25.4 26.3c-15.5 1.6-35.7 1.6-50.8 0Z"
        fill="currentColor"
      />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg className={styles.sidebarSvg} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </svg>
  );
}

function ComposeIcon() {
  return (
    <svg className={styles.sidebarSvg} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 17.2V20h2.8l8.7-8.6-2.8-2.8L5 17.2Z" />
      <path d="m15.2 7 1.8-1.8a1.7 1.7 0 0 1 2.5 0l.4.5a1.8 1.8 0 0 1-.1 2.4L18 9.9 15.2 7Z" />
    </svg>
  );
}

function PieIcon() {
  return (
    <svg className={styles.sidebarSvg} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M11 3.1v8.9h8.9A9 9 0 0 0 11 3.1Z" />
      <path d="M20.5 13A9.5 9.5 0 1 1 10 3.5V13h10.5Z" />
    </svg>
  );
}

function NetworkIcon() {
  return (
    <svg className={styles.sidebarSvg} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="6" cy="6" r="2.2" />
      <circle cx="18" cy="8" r="2.2" />
      <circle cx="9" cy="18" r="2.2" />
      <path d="M7.8 7.2 16 8M7.3 7.8l1.4 8M16.2 9.8 10.7 16.6" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg className={styles.sidebarSvg} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3h8l4 4v14H7z" />
      <path d="M15 3v4h4M10 12h6M10 16h6" />
    </svg>
  );
}

function AboutIcon() {
  return (
    <svg className={styles.sidebarSvg} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <rect x="11.15" y="10.2" width="1.7" height="6.2" rx="0.8" />
      <circle cx="12" cy="7.4" r="1.1" />
    </svg>
  );
}

function DatabaseIcon() {
  return (
    <svg className={styles.sidebarSvg} viewBox="0 0 24 24" aria-hidden="true">
      <ellipse cx="12" cy="6" rx="7" ry="2.7" />
      <path d="M5 6v9.5c0 1.5 3.1 2.7 7 2.7s7-1.2 7-2.7V6" />
      <path d="M5 10.8c0 1.5 3.1 2.7 7 2.7s7-1.2 7-2.7" />
    </svg>
  );
}

interface NavItem {
  readonly key: SidebarView;
  readonly label: string;
  readonly IconComponent: () => ReactElement;
}

const navItems: readonly NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', IconComponent: GridIcon },
  { key: 'handlers', label: 'Handlers', IconComponent: ComposeIcon },
  { key: 'operations', label: 'Operations', IconComponent: PieIcon },
  { key: 'network', label: 'Network', IconComponent: NetworkIcon },
  { key: 'reports', label: 'Raw Data', IconComponent: DocumentIcon },
];

export function Sidebar({
  activeView,
  onViewChange,
  dataSourceActive,
  onDataSourceClick,
}: SidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.logoArea}>
        <LogoMark />
      </div>
      <nav className={styles.navList} aria-label="Primary navigation">
        {navItems.map((item, index) => (
          <button
            type="button"
            key={`${item.label}-${index}`}
            className={`${styles.navButton} ${item.key === activeView ? styles.navButtonActive : ''}`}
            aria-label={item.label}
            onClick={() => onViewChange(item.key)}
          >
            <item.IconComponent />
          </button>
        ))}
      </nav>
      <div className={styles.sidebarBottom}>
        <button
          type="button"
          className={`${styles.navButton} ${dataSourceActive ? styles.navButtonActive : ''}`}
          aria-label="Data source settings"
          onClick={onDataSourceClick}
        >
          <DatabaseIcon />
        </button>
        <button
          type="button"
          className={`${styles.navButton} ${activeView === 'about' ? styles.navButtonActive : ''}`}
          aria-label="About"
          onClick={() => onViewChange('about')}
        >
          <AboutIcon />
        </button>
      </div>
    </aside>
  );
}
