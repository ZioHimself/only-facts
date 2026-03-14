'use client';

import { useEffect, useMemo, useState } from 'react';
import { DataSourcePanel, type DataSourceType } from '@/app/components/DataSourcePanel';
import { DataColumn } from '@/app/components/DataColumn';
import { FilterGroup } from '@/app/components/FilterGroup';
import { ServerLogsPanel } from '@/app/components/ServerLogsPanel';
import { Sidebar, type SidebarView } from '@/app/components/Sidebar';
import { SummarySegment } from '@/app/components/SummarySegment';
import {
  columns,
  filterOptions,
  filters,
  summarySegments,
  type DataColumnData,
} from '@/app/data/dashboardData';
import styles from '@/app/styles/dashboard.module.css';

const APP_VERSION = '0.1.0';

function BrowserChrome() {
  return <div className={styles.browserChrome} />;
}

function toNumeric(value: string): number | null {
  const normalized = value.replace(/,/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function scaleColumns(baseColumns: readonly DataColumnData[], factor: number): DataColumnData[] {
  return baseColumns.map((column) => ({
    ...column,
    sections: column.sections.map((section) => ({
      ...section,
      rows: section.rows.map((row) => {
        const parsed = toNumeric(row.value);
        if (parsed === null) {
          return row;
        }
        return {
          ...row,
          value: formatNumber(Math.max(1, Math.round(parsed * factor))),
        };
      }),
    })),
  }));
}

function toOfflineColumns(baseColumns: readonly DataColumnData[]): DataColumnData[] {
  return baseColumns.map((column) => ({
    ...column,
    sections: column.sections.map((section) => ({
      ...section,
      rows: section.rows.map((row) => ({
        ...row,
        value: '--',
        percentage: undefined,
      })),
    })),
  }));
}

function yamlValue(value: string): string {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

function buildMockYaml({
  project,
  platform,
  narrative,
  summary,
  detailColumns,
}: {
  readonly project: string;
  readonly platform: string;
  readonly narrative: string;
  readonly summary: typeof summarySegments;
  readonly detailColumns: readonly DataColumnData[];
}): string {
  const summaryYaml = summary
    .map(
      (item) =>
        `  - label: ${yamlValue(item.label)}\n    value: ${yamlValue(item.value)}\n    icon: ${yamlValue(item.icon)}`
    )
    .join('\n');

  const columnsYaml = detailColumns
    .map((column) => {
      const sectionsYaml = column.sections
        .map((section) => {
          const rowsYaml = section.rows
            .map((row) => {
              const markerToneLine = row.markerTone
                ? `\n          markerTone: ${yamlValue(row.markerTone)}`
                : '';
              const percentageLine = row.percentage
                ? `\n          percentage: ${yamlValue(row.percentage)}`
                : '';
              return `        - label: ${yamlValue(row.label)}\n          value: ${yamlValue(row.value)}${percentageLine}${markerToneLine}`;
            })
            .join('\n');
          const headingLine = section.heading
            ? `\n      heading: ${yamlValue(section.heading)}`
            : '';
          return `    -${headingLine}\n      rows:\n${rowsYaml}`;
        })
        .join('\n');
      return `  - title: ${yamlValue(column.title)}\n    sections:\n${sectionsYaml}`;
    })
    .join('\n');

  return [
    'source: mock',
    'filters:',
    `  project: ${yamlValue(project)}`,
    `  platform: ${yamlValue(platform)}`,
    `  narrative: ${yamlValue(narrative)}`,
    'summary:',
    summaryYaml,
    'columns:',
    columnsYaml,
  ].join('\n');
}

type PlatformHandlers = Record<string, string[]>;
type PlatformDrafts = Record<string, string>;
interface ClusterNode {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly group: number;
}

interface ClusterEdge {
  readonly from: string;
  readonly to: string;
}

interface ClusterGraphData {
  readonly nodes: readonly ClusterNode[];
  readonly edges: readonly ClusterEdge[];
}

interface CohortComparison {
  readonly cohort: string;
  readonly reach: number;
  readonly engagementRate: number;
  readonly riskScore: number;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let result = Math.imul(t ^ (t >>> 15), 1 | t);
    result ^= result + Math.imul(result ^ (result >>> 7), 61 | result);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function generateMockClusterGraph(seed: number): ClusterGraphData {
  const random = mulberry32(seed);
  const groupCenters = [
    { x: 18, y: 28 },
    { x: 50, y: 20 },
    { x: 78, y: 32 },
    { x: 38, y: 66 },
    { x: 68, y: 70 },
  ] as const;

  const nodes: ClusterNode[] = [];
  const edges: ClusterEdge[] = [];

  groupCenters.forEach((center, groupIndex) => {
    const count = 5 + Math.floor(random() * 4);
    for (let i = 0; i < count; i += 1) {
      const id = `G${groupIndex + 1}-${i + 1}`;
      nodes.push({
        id,
        x: center.x + (random() * 18 - 9),
        y: center.y + (random() * 14 - 7),
        group: groupIndex,
      });
    }
  });

  const groups = new Map<number, ClusterNode[]>();
  for (const node of nodes) {
    const existing = groups.get(node.group) ?? [];
    groups.set(node.group, [...existing, node]);
  }

  groups.forEach((groupNodes) => {
    for (let i = 0; i < groupNodes.length - 1; i += 1) {
      edges.push({ from: groupNodes[i].id, to: groupNodes[i + 1].id });
      if (i + 2 < groupNodes.length && random() > 0.5) {
        edges.push({ from: groupNodes[i].id, to: groupNodes[i + 2].id });
      }
    }
  });

  const groupKeys = Array.from(groups.keys()).sort((a, b) => a - b);
  for (let i = 0; i < groupKeys.length - 1; i += 1) {
    const aGroup = groups.get(groupKeys[i]) ?? [];
    const bGroup = groups.get(groupKeys[i + 1]) ?? [];
    if (aGroup.length > 0 && bGroup.length > 0) {
      const from = aGroup[Math.floor(random() * aGroup.length)];
      const to = bGroup[Math.floor(random() * bGroup.length)];
      edges.push({ from: from.id, to: to.id });
    }
  }

  return { nodes, edges };
}

function generateMockCohorts(seed: number): readonly CohortComparison[] {
  const random = mulberry32(seed);
  const cohorts = [
    'Ukraine Supporter',
    'Left Wing',
    'Russian State Supporter',
    'NATO Advocate',
    'Right Wing',
  ];

  return cohorts.map((cohort) => ({
    cohort,
    reach: 12000 + Math.floor(random() * 52000),
    engagementRate: Number((2.1 + random() * 12.4).toFixed(1)),
    riskScore: Number((18 + random() * 72).toFixed(1)),
  }));
}

function ViewBody({
  activeView,
  dynamicSummary,
  dynamicColumns,
  rawDataText,
  rawServerLogsText,
  apiStatus,
  platformOrder,
  handlersByPlatform,
  handlerDrafts,
  onHandlerDraftChange,
  onAddHandler,
  clusterGraph,
  onOpenClusterGraph,
  cohortData,
  onCompareCohorts,
}: {
  readonly activeView: SidebarView;
  readonly dynamicSummary: typeof summarySegments;
  readonly dynamicColumns: readonly DataColumnData[];
  readonly rawDataText: string;
  readonly rawServerLogsText: string;
  readonly apiStatus: {
    readonly ingestion: string;
    readonly connection: string;
    readonly dbPool: string;
    readonly queue: string;
    readonly lastUpdate: string;
  };
  readonly platformOrder: readonly string[];
  readonly handlersByPlatform: PlatformHandlers;
  readonly handlerDrafts: PlatformDrafts;
  readonly onHandlerDraftChange: (platform: string, nextValue: string) => void;
  readonly onAddHandler: (platform: string) => void;
  readonly clusterGraph: ClusterGraphData;
  readonly onOpenClusterGraph: () => void;
  readonly cohortData: readonly CohortComparison[];
  readonly onCompareCohorts: () => void;
}) {
  if (activeView === 'handlers') {
    return (
      <section className={styles.utilityPanel} aria-label="Social handlers view">
        <h2 className={styles.utilityTitle}>Social Platform Handlers</h2>
        <p className={styles.utilityText}>
          Manage profile handlers and source URLs per platform for ingestion routing.
        </p>
        <div className={styles.handlersGrid}>
          {platformOrder.map((platform) => (
            <article key={platform} className={styles.handlerColumn}>
              <h3 className={styles.handlerColumnTitle}>{platform}</h3>
              <div className={styles.handlerInputRow}>
                <input
                  className={styles.handlerInput}
                  value={handlerDrafts[platform] ?? ''}
                  onChange={(event) => onHandlerDraftChange(platform, event.target.value)}
                  placeholder="@handle or https://profile.url"
                />
                <button
                  type="button"
                  className={styles.handlerAddButton}
                  onClick={() => onAddHandler(platform)}
                >
                  +
                </button>
              </div>
              <ul className={styles.handlerList}>
                {(handlersByPlatform[platform] ?? []).map((value) => (
                  <li key={`${platform}-${value}`} className={styles.handlerItem}>
                    {value}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    );
  }

  if (activeView === 'reports') {
    return (
      <section className={styles.utilityPanel} aria-label="Raw data and API status view">
        <h2 className={styles.utilityTitle}>Raw Data + API Status</h2>
        <p className={styles.utilityText}>
          Technical ingestion diagnostics and raw payload snapshot from the active source.
        </p>
        <div className={styles.statusGrid}>
          <article className={styles.statusCard}>
            <h3 className={styles.statusTitle}>Ingestion API</h3>
            <p className={styles.statusValue}>{apiStatus.ingestion}</p>
          </article>
          <article className={styles.statusCard}>
            <h3 className={styles.statusTitle}>Connection Manager</h3>
            <p className={styles.statusValue}>{apiStatus.connection}</p>
          </article>
          <article className={styles.statusCard}>
            <h3 className={styles.statusTitle}>DB Pool</h3>
            <p className={styles.statusValue}>{apiStatus.dbPool}</p>
          </article>
          <article className={styles.statusCard}>
            <h3 className={styles.statusTitle}>Queue</h3>
            <p className={styles.statusValue}>{apiStatus.queue}</p>
          </article>
        </div>
        <p className={styles.statusMeta}>Last server update: {apiStatus.lastUpdate}</p>
        <h3 className={styles.statusTitle}>Raw Server Logs</h3>
        <pre className={styles.rawLogsBox}>{rawServerLogsText}</pre>
        <h3 className={styles.statusTitle}>Raw Source Payload</h3>
        <pre className={styles.rawDataBox}>{rawDataText}</pre>
      </section>
    );
  }

  if (activeView === 'operations') {
    return (
      <section className={styles.utilityPanel} aria-label="Operations view">
        <h2 className={styles.utilityTitle}>Operations Feed</h2>
        <p className={styles.utilityText}>
          Real-time analyst operations surface. Trigger counter-narrative workflows and escalation
          checks.
        </p>
        <ul className={styles.utilityList}>
          <li>Escalation threshold reached in 2 monitored cohorts</li>
          <li>Automated alert review pending for high-risk topic clusters</li>
          <li>Collection sync complete for selected platform</li>
        </ul>
      </section>
    );
  }

  if (activeView === 'network') {
    const nodeMap = new Map(clusterGraph.nodes.map((node) => [node.id, node]));
    const nodeColors = ['#6ca6d9', '#a88dd7', '#63b899', '#d09a5f', '#b46f75'] as const;

    return (
      <section className={styles.utilityPanel} aria-label="Network view">
        <h2 className={styles.utilityTitle}>Network Explorer</h2>
        <p className={styles.utilityText}>
          Investigate relationship clusters between authors, topics, and engagement behavior.
        </p>
        <div className={styles.networkGrid}>
          <article className={styles.networkCard}>
            <h3 className={styles.networkCardTitle}>High-Risk Clusters</h3>
            <p className={styles.networkCardValue}>12 Active</p>
            <p className={styles.networkCardMeta}>3 clusters trending upward in the last 24h</p>
          </article>
          <article className={styles.networkCard}>
            <h3 className={styles.networkCardTitle}>Bridge Accounts</h3>
            <p className={styles.networkCardValue}>48 Nodes</p>
            <p className={styles.networkCardMeta}>Cross-posting across 2+ narratives</p>
          </article>
          <article className={styles.networkCard}>
            <h3 className={styles.networkCardTitle}>Coordinated Bursts</h3>
            <p className={styles.networkCardValue}>7 Signals</p>
            <p className={styles.networkCardMeta}>Burst windows under 5 minutes</p>
          </article>
        </div>
        <div className={styles.networkActions}>
          <button type="button" className={styles.networkActionButton} onClick={onOpenClusterGraph}>
            Open Cluster Graph
          </button>
          <button type="button" className={styles.networkActionButton} onClick={onCompareCohorts}>
            Compare Cohorts
          </button>
          <button type="button" className={styles.networkActionButton}>
            Export Adjacency List
          </button>
        </div>
        <div className={styles.clusterGraphWrap}>
          <svg
            className={styles.clusterGraph}
            viewBox="0 0 100 100"
            role="img"
            aria-label="Mock cluster graph"
          >
            {clusterGraph.edges.map((edge) => {
              const fromNode = nodeMap.get(edge.from);
              const toNode = nodeMap.get(edge.to);
              if (!fromNode || !toNode) {
                return null;
              }
              return (
                <line
                  key={`${edge.from}-${edge.to}`}
                  x1={fromNode.x}
                  y1={fromNode.y}
                  x2={toNode.x}
                  y2={toNode.y}
                  className={styles.clusterEdge}
                />
              );
            })}
            {clusterGraph.nodes.map((node) => (
              <circle
                key={node.id}
                cx={node.x}
                cy={node.y}
                r={1.8}
                fill={nodeColors[node.group % nodeColors.length]}
                className={styles.clusterNode}
              />
            ))}
          </svg>
        </div>
        <div className={styles.cohortDemo}>
          <h3 className={styles.statusTitle}>Cohort Comparison (Demo)</h3>
          <table className={styles.cohortTable}>
            <thead>
              <tr>
                <th>Cohort</th>
                <th>Reach</th>
                <th>Engagement %</th>
                <th>Risk Score</th>
              </tr>
            </thead>
            <tbody>
              {cohortData.map((row) => (
                <tr key={row.cohort}>
                  <td>{row.cohort}</td>
                  <td>{formatNumber(row.reach)}</td>
                  <td>{row.engagementRate.toFixed(1)}</td>
                  <td>{row.riskScore.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  if (activeView === 'about') {
    return (
      <section className={styles.utilityPanel} aria-label="About view">
        <h2 className={styles.utilityTitle}>About This Interface</h2>
        <p className={styles.utilityText}>
          This workspace is a high-fidelity intelligence dashboard interface with interactive source
          controls and operator views.
        </p>
        <div className={styles.aboutGrid}>
          <article className={styles.aboutCard}>
            <h3 className={styles.aboutCardTitle}>Version</h3>
            <p className={styles.aboutCardValue}>v{APP_VERSION}</p>
            <p className={styles.aboutCardMeta}>Only Facts campaign reporting dashboard.</p>
          </article>
          <article className={styles.aboutCard}>
            <h3 className={styles.aboutCardTitle}>Stack</h3>
            <p className={styles.aboutCardValue}>Next.js + TypeScript</p>
            <p className={styles.aboutCardMeta}>
              Component-based UI with modular styling and typed mock data flow.
            </p>
          </article>
          <article className={styles.aboutCard}>
            <h3 className={styles.aboutCardTitle}>Data Modes</h3>
            <p className={styles.aboutCardValue}>Mock / DB / API / JSON / YAML</p>
            <p className={styles.aboutCardMeta}>
              Single-source active mode enforced from Data Source Settings.
            </p>
          </article>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className={styles.summaryStrip} aria-label="Summary metrics">
        {dynamicSummary.map((segment) => (
          <SummarySegment key={segment.label} segment={segment} />
        ))}
      </section>

      <section className={styles.analyticsPanel} aria-label="Detailed analytics">
        {dynamicColumns.map((column) => (
          <DataColumn key={column.title} column={column} />
        ))}
      </section>
    </>
  );
}

export default function Home() {
  const platformOrder = useMemo<readonly string[]>(
    () => ['Twitter', 'Telegram', 'Reddit', 'YouTube', 'Instagram', 'Facebook'],
    []
  );
  const [selectedProject, setSelectedProject] = useState<string>(filters[0].value);
  const [selectedPlatform, setSelectedPlatform] = useState<string>(filters[1].value);
  const [selectedNarrative, setSelectedNarrative] = useState<string>(filters[2].value);
  const [activeView, setActiveView] = useState<SidebarView>('dashboard');
  const [isDataSourceOpen, setIsDataSourceOpen] = useState<boolean>(false);
  const [isServerLogsOpen, setIsServerLogsOpen] = useState<boolean>(false);
  const [dataSourceType, setDataSourceType] = useState<DataSourceType>('db_url');
  const [dbUrl, setDbUrl] = useState<string>('postgresql://analyst:••••••@secure-db:5432/osint');
  const [apiUrl, setApiUrl] = useState<string>('https://api.intel.local/v1/metrics');
  const [jsonFileName, setJsonFileName] = useState<string>('');
  const [yamlFileName, setYamlFileName] = useState<string>('');
  const [mockDataEnabled, setMockDataEnabled] = useState<boolean>(true);
  const [serverLogs, setServerLogs] = useState<readonly string[]>([
    '[waiting] open Raw Server Logs panel to stream backend status logs',
  ]);
  const [isLogsLoading, setIsLogsLoading] = useState<boolean>(false);
  const [logsError, setLogsError] = useState<string>('');
  const [apiStatus, setApiStatus] = useState<{
    ingestion: string;
    connection: string;
    dbPool: string;
    queue: string;
    lastUpdate: string;
  }>({
    ingestion: 'UNKNOWN',
    connection: 'UNKNOWN',
    dbPool: 'UNKNOWN',
    queue: 'UNKNOWN',
    lastUpdate: 'n/a',
  });
  const [handlersByPlatform, setHandlersByPlatform] = useState<PlatformHandlers>({
    Twitter: ['@intel_watch', 'https://x.com/osintmonitor'],
    Telegram: ['https://t.me/intelfeed'],
    Reddit: ['u/geo_signal_ops'],
    YouTube: [],
    Instagram: [],
    Facebook: [],
  });
  const [handlerDrafts, setHandlerDrafts] = useState<PlatformDrafts>({
    Twitter: '',
    Telegram: '',
    Reddit: '',
    YouTube: '',
    Instagram: '',
    Facebook: '',
  });
  const [clusterSeed, setClusterSeed] = useState<number>(() => Date.now());
  const [cohortSeed, setCohortSeed] = useState<number>(() => Date.now() + 1337);

  const projectFactor = useMemo<number>(() => {
    if (selectedProject === 'Cross-Border Influence Monitoring') {
      return 0.88;
    }
    if (selectedProject === 'Election Narrative Simulation') {
      return 0.76;
    }
    return 1;
  }, [selectedProject]);

  const platformFactor = useMemo<number>(() => {
    if (selectedPlatform === 'Telegram') {
      return 0.73;
    }
    if (selectedPlatform === 'Reddit') {
      return 0.58;
    }
    return 1;
  }, [selectedPlatform]);

  const narrativeFactor = useMemo<number>(() => {
    if (selectedNarrative === 'Racial Equality Advocacy') {
      return 0.67;
    }
    if (selectedNarrative === 'Geopolitical Escalation') {
      return 0.61;
    }
    return 1;
  }, [selectedNarrative]);

  const blendedFactor = projectFactor * platformFactor * narrativeFactor;

  const dynamicSummary = useMemo(() => {
    const sentimentPercent = Math.min(28.9, Math.max(6.2, 16.8 * (1.2 - blendedFactor * 0.2)));
    const emotionPercent = Math.min(25.7, Math.max(5.1, 15.4 * (1.1 - blendedFactor * 0.1)));

    return summarySegments.map((segment) => {
      if (segment.label === 'TOPICS') {
        return {
          ...segment,
          value: selectedNarrative === 'All' ? 'Racial Equality Advocacy' : selectedNarrative,
        };
      }

      if (segment.label === 'SENTIMENT') {
        return {
          ...segment,
          value: `${sentimentPercent.toFixed(1)}% Negative`,
        };
      }

      if (segment.label === 'EMOTIONS') {
        return {
          ...segment,
          value: `${emotionPercent.toFixed(1)}% Anger`,
        };
      }

      const baseMetric = toNumeric(segment.value);
      if (baseMetric === null) {
        return segment;
      }

      return {
        ...segment,
        value: formatNumber(Math.max(1, Math.round(baseMetric * blendedFactor))),
      };
    });
  }, [blendedFactor, selectedNarrative]);

  const dynamicColumns = useMemo(() => scaleColumns(columns, blendedFactor), [blendedFactor]);

  const effectiveSummary = useMemo(() => {
    if (mockDataEnabled) {
      return dynamicSummary;
    }
    return summarySegments.map((segment) => {
      if (segment.label === 'TOPICS') {
        return { ...segment, value: 'No data source' };
      }
      return { ...segment, value: 'OFFLINE' };
    });
  }, [dynamicSummary, mockDataEnabled]);

  const effectiveColumns = useMemo(
    () => (mockDataEnabled ? dynamicColumns : toOfflineColumns(columns)),
    [dynamicColumns, mockDataEnabled]
  );

  const dataSourceDisplay = useMemo<string>(() => {
    if (mockDataEnabled) {
      return 'MOCK DATA ACTIVE: mock-data.yaml';
    }
    if (dataSourceType === 'db_url') {
      return `DB URL: ${dbUrl}`;
    }
    if (dataSourceType === 'api') {
      return `API: ${apiUrl}`;
    }
    if (dataSourceType === 'json') {
      return `JSON: ${jsonFileName || 'no file selected'}`;
    }
    return `YAML: ${yamlFileName || 'no file selected'}`;
  }, [apiUrl, dataSourceType, dbUrl, jsonFileName, mockDataEnabled, yamlFileName]);

  const mockDataYaml = useMemo(
    () =>
      buildMockYaml({
        project: selectedProject,
        platform: selectedPlatform,
        narrative: selectedNarrative,
        summary: dynamicSummary,
        detailColumns: dynamicColumns,
      }),
    [dynamicColumns, dynamicSummary, selectedNarrative, selectedPlatform, selectedProject]
  );

  const rawDataText = useMemo<string>(() => {
    if (mockDataEnabled) {
      return mockDataYaml;
    }

    return JSON.stringify(
      {
        sourceType: dataSourceType,
        source:
          dataSourceType === 'db_url'
            ? dbUrl
            : dataSourceType === 'api'
              ? apiUrl
              : dataSourceType === 'json'
                ? jsonFileName || null
                : yamlFileName || null,
        status: 'live-source-configured',
      },
      null,
      2
    );
  }, [apiUrl, dataSourceType, dbUrl, jsonFileName, mockDataEnabled, mockDataYaml, yamlFileName]);

  const rawServerLogsText = useMemo<string>(() => {
    const lines = [...serverLogs];
    if (isLogsLoading) {
      lines.push(`[${new Date().toISOString()}] INFO  fetching latest server log window...`);
    }
    if (logsError) {
      lines.push(`[${new Date().toISOString()}] ERROR ${logsError}`);
    }
    return lines.join('\n');
  }, [isLogsLoading, logsError, serverLogs]);

  const clusterGraph = useMemo<ClusterGraphData>(
    () => generateMockClusterGraph(clusterSeed),
    [clusterSeed]
  );
  const cohortData = useMemo<readonly CohortComparison[]>(
    () => generateMockCohorts(cohortSeed),
    [cohortSeed]
  );

  const handleHandlerDraftChange = (platform: string, nextValue: string) => {
    setHandlerDrafts((previous) => ({
      ...previous,
      [platform]: nextValue,
    }));
  };

  const handleAddHandler = (platform: string) => {
    const draft = (handlerDrafts[platform] ?? '').trim();
    if (draft.length === 0) {
      return;
    }

    setHandlersByPlatform((previous) => ({
      ...previous,
      [platform]: [...(previous[platform] ?? []), draft],
    }));

    setHandlerDrafts((previous) => ({
      ...previous,
      [platform]: '',
    }));
  };

  useEffect(() => {
    if (!isServerLogsOpen && activeView !== 'reports') {
      return;
    }

    let cancelled = false;

    const fetchServerLogs = async () => {
      setIsLogsLoading(true);
      setLogsError('');
      try {
        const response = await fetch(
          `/api/server-logs?sourceType=${dataSourceType}&mock=${mockDataEnabled ? '1' : '0'}`
        );
        if (!response.ok) {
          throw new Error(`Failed to fetch logs: ${response.status}`);
        }
        const payload = (await response.json()) as { logs?: string[]; generatedAt?: string };
        if (!cancelled) {
          const logs = Array.isArray(payload.logs) ? payload.logs : [];
          setServerLogs(
            logs.length > 0 ? logs : ['[empty] no server logs received from ingestion endpoint']
          );

          const ingestion = logs.find((line) => line.includes('service=ingestion-api status='));
          const connection = logs.find((line) => line.includes('connection=primary status='));
          const dbPool = logs.find((line) => line.includes('db-pool status='));
          const queue = logs.find((line) => line.includes('queue-monitor'));

          setApiStatus({
            ingestion: ingestion ? (ingestion.split('status=')[1] ?? 'UNKNOWN') : 'UNKNOWN',
            connection: connection
              ? (connection.split('status=')[1]?.split(' ')[0] ?? 'UNKNOWN')
              : 'UNKNOWN',
            dbPool: dbPool ? (dbPool.split('status=')[1]?.split(' ')[0] ?? 'UNKNOWN') : 'UNKNOWN',
            queue: queue ? (queue.split('backlog=')[1] ?? 'UNKNOWN') : 'UNKNOWN',
            lastUpdate: payload.generatedAt ?? new Date().toISOString(),
          });
        }
      } catch {
        if (!cancelled) {
          setLogsError('Unable to reach server log endpoint.');
          setServerLogs(['[error] server log stream unavailable']);
        }
      } finally {
        if (!cancelled) {
          setIsLogsLoading(false);
        }
      }
    };

    fetchServerLogs();
    const intervalId = window.setInterval(fetchServerLogs, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeView, dataSourceType, isServerLogsOpen, mockDataEnabled]);

  return (
    <main className={styles.page}>
      <div className={styles.windowFrame}>
        <BrowserChrome />
        <div className={styles.appShell}>
          <Sidebar
            activeView={activeView}
            onViewChange={setActiveView}
            dataSourceActive={isDataSourceOpen}
            onDataSourceClick={() => {
              setIsDataSourceOpen((previous) => !previous);
              setIsServerLogsOpen(false);
            }}
          />
          <div className={styles.contentArea}>
            <header className={styles.topBar}>
              <div className={styles.filterRow}>
                <FilterGroup
                  label="PROJECT"
                  value={selectedProject}
                  options={filterOptions.projects}
                  onChange={setSelectedProject}
                />
                <FilterGroup
                  label="PLATFORM"
                  value={selectedPlatform}
                  options={filterOptions.platforms}
                  onChange={setSelectedPlatform}
                />
                <FilterGroup
                  label="NARRATIVE"
                  value={selectedNarrative}
                  options={filterOptions.narratives}
                  onChange={setSelectedNarrative}
                />
              </div>
              <div className={styles.sourcePill}>{dataSourceDisplay}</div>
            </header>
            <ViewBody
              activeView={activeView}
              dynamicSummary={effectiveSummary}
              dynamicColumns={effectiveColumns}
              rawDataText={rawDataText}
              rawServerLogsText={rawServerLogsText}
              apiStatus={apiStatus}
              platformOrder={platformOrder}
              handlersByPlatform={handlersByPlatform}
              handlerDrafts={handlerDrafts}
              onHandlerDraftChange={handleHandlerDraftChange}
              onAddHandler={handleAddHandler}
              clusterGraph={clusterGraph}
              onOpenClusterGraph={() =>
                setClusterSeed(Date.now() + Math.floor(Math.random() * 100000))
              }
              cohortData={cohortData}
              onCompareCohorts={() =>
                setCohortSeed(Date.now() + Math.floor(Math.random() * 100000))
              }
            />
          </div>
        </div>
        <DataSourcePanel
          isOpen={isDataSourceOpen}
          sourceType={dataSourceType}
          dbUrl={dbUrl}
          apiUrl={apiUrl}
          jsonFileName={jsonFileName}
          yamlFileName={yamlFileName}
          onSourceTypeChange={(nextType) => {
            setDataSourceType(nextType);
            setMockDataEnabled(false);
          }}
          onDbUrlChange={setDbUrl}
          onApiUrlChange={setApiUrl}
          onJsonFileChange={setJsonFileName}
          onYamlFileChange={setYamlFileName}
          mockDataEnabled={mockDataEnabled}
          mockDataYaml={mockDataYaml}
          onToggleMockData={() => setMockDataEnabled((previous) => !previous)}
          externalSourcesDisabled={mockDataEnabled}
          onClose={() => setIsDataSourceOpen(false)}
        />
        <ServerLogsPanel
          isOpen={isServerLogsOpen}
          logs={
            logsError
              ? [...serverLogs, `[${new Date().toISOString()}] ERROR ${logsError}`]
              : isLogsLoading
                ? [
                    ...serverLogs,
                    `[${new Date().toISOString()}] INFO  fetching latest server log window...`,
                  ]
                : serverLogs
          }
          onClose={() => setIsServerLogsOpen(false)}
        />
      </div>
    </main>
  );
}
