import styles from '@/app/styles/dashboard.module.css';
import type { SummarySegmentData } from '@/app/data/dashboardData';

interface SummarySegmentProps {
  readonly segment: SummarySegmentData;
}

function SegmentIcon({ icon }: Pick<SummarySegmentData, 'icon'>) {
  const commonProps = {
    className: styles.segmentSvg,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (icon) {
    case 'posts':
      return (
        <svg {...commonProps}>
          <rect x="3" y="4" width="18" height="14" rx="2" />
          <path d="M7 18v2l4-2" />
          <circle cx="8.5" cy="10" r="1" />
        </svg>
      );
    case 'engagements':
      return (
        <svg {...commonProps}>
          <circle cx="7" cy="8" r="2.5" />
          <circle cx="17" cy="7" r="2.5" />
          <circle cx="12" cy="17" r="2.5" />
          <path d="M9 9.5l2.5 5M15 8.7l-1.8 5.6" />
        </svg>
      );
    case 'authors':
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="8" r="3.2" />
          <path d="M5 19c1.8-3.7 4.3-5.2 7-5.2s5.2 1.5 7 5.2" />
        </svg>
      );
    case 'topics':
      return (
        <svg {...commonProps}>
          <circle cx="6.5" cy="7" r="2" />
          <circle cx="17.5" cy="7" r="2" />
          <circle cx="12" cy="17" r="2" />
          <path d="M8 8.5l2.8 6M16 8.5l-2.8 6M8.5 7h7" />
        </svg>
      );
    case 'sentiment':
      return (
        <svg {...commonProps}>
          <path d="M6 8h12" />
          <path d="M8.5 16.2h7" />
          <path d="M8.5 12.1h7" />
          <path d="M6 8.2l2.3-2.3M6 8.2l2.3 2.3" />
        </svg>
      );
    case 'emotions':
      return (
        <svg {...commonProps}>
          <path d="M7 6h10v12H7z" />
          <path d="M9 10h.01M15 10h.01" />
          <path d="M9 14c1.1.9 2 .9 3 .9s1.9 0 3-.9" />
        </svg>
      );
    default:
      return null;
  }
}

export function SummarySegment({ segment }: SummarySegmentProps) {
  return (
    <article className={styles.summarySegment}>
      <div className={styles.segmentIconTile}>
        <SegmentIcon icon={segment.icon} />
      </div>
      <div className={styles.segmentText}>
        <div className={styles.segmentLabel}>{segment.label}</div>
        <div className={styles.segmentValue}>{segment.value}</div>
      </div>
    </article>
  );
}
