import Schema from '@deepseek-ai/schemastery';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ToolDefinition } from './types.js';
import { currentBranch } from '../lib/factory.js';

export interface LedgerInput {
  action: 'start' | 'beat' | 'touch' | 'finish' | 'status';
  runId?: string;
  taskClass?: string;
  taskSize?: string;
  beatName?: string;
  evidenceArtifact?: string;
  modelTier?: 'fast' | 'balanced' | 'frontier';
  outcome?: string;
  note?: string;
}

export interface LedgerOutput {
  status: 'ok' | 'created' | 'updated' | 'finished' | 'error';
  runId?: string;
  runFile?: string;
  details?: Record<string, any>;
  error?: string;
}

export const ledgerTool: ToolDefinition<LedgerInput, LedgerOutput> = {
  name: 'factory_ledger',
  description: 'Record beats, human corrections, tokens, and evidence in .factory/runs/ for outer loop telemetry.',
  parameters: Schema.object({
    action: Schema.union([
      Schema.const('start').description('Start a new run ledger record'),
      Schema.const('beat').description('Record progress on an inner loop beat'),
      Schema.const('touch').description('Record a human touch or correction'),
      Schema.const('finish').description('Mark run finished with an outcome'),
      Schema.const('status').description('Inspect current open run status'),
    ]).required(),
    runId: Schema.string().description('Existing run ID (or "current" for active branch)'),
    taskClass: Schema.string().description('Task classification (e.g. bugfix, feature, chore, loop)'),
    taskSize: Schema.string().description('Task size (small, medium, large)'),
    beatName: Schema.string().description('Completed beat (triage, aim, spec, isolate, build, prove, ship, monitor)'),
    evidenceArtifact: Schema.string().description('Path to generated test evidence artifact'),
    modelTier: Schema.union([
      Schema.const('fast'),
      Schema.const('balanced'),
      Schema.const('frontier'),
    ]).description('Model tier employed for this task'),
    outcome: Schema.string().description('Final outcome (shipped, merged, blocked, declined)'),
    note: Schema.string().description('Optional note or description'),
  }),
  execute: async (
    { action, runId, taskClass, taskSize, beatName, evidenceArtifact, modelTier, outcome, note },
    env = {}
  ) => {
    const root = env.cwd || process.cwd();
    const runsDir = join(root, '.factory', 'runs');
    try {
      mkdirSync(runsDir, { recursive: true });
    } catch {
      // Directory creation fallback
    }

    const branch = currentBranch(root) || 'main';
    const activeId = runId && runId !== 'current' ? runId : `run-${Date.now()}`;
    const runFile = join(runsDir, `${activeId}.json`);

    let record: Record<string, any> = {
      id: activeId,
      branch,
      task: {
        class: taskClass || 'general',
        size: taskSize || 'small',
      },
      model: {
        tier: modelTier || 'balanced',
      },
      beats: {},
      memories: { used: [], written: [] },
      human_touches: [],
      started_at: new Date().toISOString(),
      finished_at: null,
      outcome: null,
    };

    if (existsSync(runFile)) {
      try {
        record = JSON.parse(readFileSync(runFile, 'utf8'));
      } catch {
        // Fallback
      }
    }

    switch (action) {
      case 'start': {
        writeFileSync(runFile, JSON.stringify(record, null, 2));
        return { status: 'created', runId: activeId, runFile, details: record };
      }

      case 'beat': {
        if (!beatName) throw new Error('beatName is required for action: beat');
        record.beats[beatName] = {
          completed_at: new Date().toISOString(),
          evidence: evidenceArtifact ? [evidenceArtifact] : record.beats[beatName]?.evidence || [],
          note: note || undefined,
        };
        writeFileSync(runFile, JSON.stringify(record, null, 2));
        return { status: 'updated', runId: activeId, runFile, details: record };
      }

      case 'touch': {
        record.human_touches.push({
          kind: 'correction',
          beat: beatName || 'build',
          note: note || 'Human interaction recorded',
          at: new Date().toISOString(),
        });
        writeFileSync(runFile, JSON.stringify(record, null, 2));
        return { status: 'updated', runId: activeId, runFile, details: record };
      }

      case 'finish': {
        record.outcome = outcome || 'shipped';
        record.finished_at = new Date().toISOString();
        if (evidenceArtifact && beatName) {
          record.beats[beatName] = {
            ...record.beats[beatName],
            evidence: [evidenceArtifact],
          };
        }
        writeFileSync(runFile, JSON.stringify(record, null, 2));
        return { status: 'finished', runId: activeId, runFile, details: record };
      }

      case 'status': {
        return { status: 'ok', runId: activeId, runFile, details: record };
      }
    }
  },
};
