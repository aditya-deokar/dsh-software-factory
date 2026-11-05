import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface RunRecord {
  schema?: number;
  id: string;
  title?: string | null;
  branch?: string | null;
  task?: {
    source?: string | null;
    class?: string;
    size?: string;
  };
  harness?: string | null;
  model?: {
    tier?: string | null;
    id?: string | null;
    rule?: string | null;
  } | null;
  beats?: Record<string, any>;
  memories?: {
    used?: string[];
    written?: string[];
  };
  human_touches?: Array<{
    beat: string;
    kind: string;
    ref?: string | null;
    note?: string | null;
    at?: string;
  }>;
  cost?: {
    input_tokens: number;
    cached_input_tokens: number;
    output_tokens: number;
    source?: string;
  } | null;
  started_at?: string;
  finished_at?: string | null;
  outcome?: string | null;
}

export interface FactoryReportData {
  runs: number;
  open: number;
  by_outcome: Record<string, number>;
  by_class: Record<string, number>;
  by_tier: Record<string, number>;
  shipped: number;
  merged: number;
  human_touches: number;
  corrections: number;
  evidence_rate: string;
  median_minutes: number;
}

function parseDurationMs(duration: string): number {
  const m = duration.match(/^(\d+)([dhms])$/);
  if (!m) return 14 * 24 * 60 * 60 * 1000;
  const val = parseInt(m[1], 10);
  switch (m[2]) {
    case 'd':
      return val * 24 * 60 * 60 * 1000;
    case 'h':
      return val * 60 * 60 * 1000;
    case 'm':
      return val * 60 * 1000;
    case 's':
      return val * 1000;
    default:
      return 14 * 24 * 60 * 60 * 1000;
  }
}

export function loadRunsFromDir(runsDir: string): RunRecord[] {
  if (!existsSync(runsDir)) return [];
  try {
    return readdirSync(runsDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        try {
          return JSON.parse(readFileSync(join(runsDir, f), 'utf8')) as RunRecord;
        } catch {
          return null;
        }
      })
      .filter((r): r is RunRecord => r !== null);
  } catch {
    return [];
  }
}

export function generateReport(runs: RunRecord[], window: string = '14d'): FactoryReportData {
  const windowMs = window === 'all' ? Infinity : parseDurationMs(window);
  const now = Date.now();
  const filtered = runs.filter((r) => {
    if (window === 'all') return true;
    if (!r.started_at) return true;
    const started = Date.parse(r.started_at);
    return isNaN(started) || now - started <= windowMs;
  });

  const byOutcome: Record<string, number> = {};
  const byClass: Record<string, number> = {};
  const byTier: Record<string, number> = {};
  let shipped = 0;
  let merged = 0;
  let open = 0;
  let touches = 0;
  let corrections = 0;
  let reachedShipWithEvidence = 0;
  let reachedShipTotal = 0;

  for (const r of filtered) {
    if (!r.finished_at) open++;
    const outcome = r.outcome || 'open';
    byOutcome[outcome] = (byOutcome[outcome] || 0) + 1;
    if (outcome === 'shipped') shipped++;
    if (outcome === 'merged') {
      shipped++;
      merged++;
    }

    const cls = r.task?.class || 'unclassified';
    byClass[cls] = (byClass[cls] || 0) + 1;

    const tier = r.model?.tier || 'default';
    byTier[tier] = (byTier[tier] || 0) + 1;

    if (r.human_touches) {
      touches += r.human_touches.length;
      corrections += r.human_touches.filter((t) => t.kind === 'correction').length;
    }

    if (r.beats?.ship) {
      reachedShipTotal++;
      if (r.beats?.prove?.evidence?.length > 0) reachedShipWithEvidence++;
    }
  }

  const evidenceRate = reachedShipTotal ? `${Math.round((reachedShipWithEvidence / reachedShipTotal) * 100)}%` : 'n/a';

  return {
    runs: filtered.length,
    open,
    by_outcome: byOutcome,
    by_class: byClass,
    by_tier: byTier,
    shipped,
    merged,
    human_touches: touches,
    corrections,
    evidence_rate: evidenceRate,
    median_minutes: 0,
  };
}

export function formatReportMarkdown(rep: FactoryReportData, window: string = '14d'): string {
  const kv = (o: Record<string, number>) =>
    Object.entries(o)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ') || 'none';

  return [
    `## Software Factory Report (${window})`,
    '',
    '| Measure | Value |',
    '|---|---|',
    `| Total Runs | ${rep.runs} (${rep.open} open) |`,
    `| Outcomes | ${kv(rep.by_outcome)} |`,
    `| By Task Class | ${kv(rep.by_class)} |`,
    `| By Model Tier | ${kv(rep.by_tier)} |`,
    `| Shipped / Merged | ${rep.shipped} / ${rep.merged} |`,
    `| Human Touches | ${rep.human_touches} (${rep.corrections} corrections) |`,
    `| Evidence Rate | ${rep.evidence_rate} |`,
  ].join('\n');
}
