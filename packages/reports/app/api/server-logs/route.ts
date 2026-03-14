import { NextResponse } from 'next/server';

type SourceType = 'db_url' | 'json' | 'yaml' | 'api';

function toSourceType(value: string | null): SourceType {
  if (value === 'json' || value === 'yaml' || value === 'api') {
    return value;
  }
  return 'db_url';
}

function buildServerLogs(sourceType: SourceType, mockEnabled: boolean): string[] {
  const now = new Date().toISOString();
  const ingestLatencyMs = 18 + Math.floor(Math.random() * 36);
  const dbLatencyMs = 5 + Math.floor(Math.random() * 12);
  const backlog = 40 + Math.floor(Math.random() * 120);
  const reconnects = Math.floor(Math.random() * 3);

  const sourceLine = mockEnabled
    ? `[${now}] INFO  ingestion-api source=mock-data.yaml mode=MOCK_ONLY`
    : `[${now}] INFO  ingestion-api source=${sourceType} mode=LIVE_INGEST`;

  return [
    sourceLine,
    `[${now}] INFO  ingestion-api connection=primary status=CONNECTED latency_ms=${ingestLatencyMs}`,
    `[${now}] INFO  ingestion-api connection=secondary status=STANDBY reconnects_last_hour=${reconnects}`,
    `[${now}] INFO  parser-pipeline stage=normalize status=RUNNING throughput_rps=${Math.max(12, 80 - reconnects * 8)}`,
    `[${now}] INFO  db-pool status=HEALTHY active=4 idle=11 query_latency_ms=${dbLatencyMs}`,
    `[${now}] WARN  queue-monitor topic=ingestion.events backlog=${backlog}`,
    `[${now}] INFO  health-check service=ingestion-api status=UP`,
    `[${now}] INFO  health-check service=connection-manager status=UP`,
    `[${now}] INFO  telemetry heartbeat=ok span=5s`,
  ];
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sourceType = toSourceType(url.searchParams.get('sourceType'));
  const mockEnabled = url.searchParams.get('mock') === '1';

  return NextResponse.json({
    logs: buildServerLogs(sourceType, mockEnabled),
    generatedAt: new Date().toISOString(),
  });
}
