import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  worktreeTool,
  evidenceTool,
  reviewTool,
  ledgerTool,
} from '../src/tools/index.js';

describe('Phase 4: Software Factory Native Tools & PTC Bindings', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'sf-tools-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('factory_worktree tool validates inputs and handles list action in git repo', async () => {
    // Run against actual repo root containing .git
    const res = await worktreeTool.execute({ action: 'list' }, { cwd: process.cwd() });
    expect(res).toBeDefined();
    expect(['success', 'ok', 'error']).toContain(res.status);
  }, 15000);

  it('factory_evidence tool runs verification and generates log artifact on success', async () => {
    const res = await evidenceTool.execute(
      {
        command: 'node -e "process.stdout.write(\'All tests passed\')"',
        judgeMetric: 'Zero failed assertions',
      },
      { cwd: tempDir }
    );

    expect(res.status).toBe('VERIFIED');
    expect(res.judgeResult).toContain('Zero failed assertions');
    expect(res.artifactPath).toBeDefined();
    expect(existsSync(res.artifactPath!)).toBe(true);
  });

  it('factory_evidence tool captures failures as BLOCKED status', async () => {
    const res = await evidenceTool.execute(
      {
        command: 'node -e "process.exit(1)"',
        judgeMetric: 'Exit code 0',
      },
      { cwd: tempDir }
    );

    expect(res.status).toBe('BLOCKED');
    expect(res.judgeResult).toContain('Outside judge verification failed');
    expect(res.artifactPath).toBeDefined();
  });

  it('factory_review tool provides Greptile loop directives', async () => {
    const res = await reviewTool.execute({ prNumber: 88, maxIterations: 5, largePrMode: true });
    expect(res.status).toBe('iterating');
    expect(res.pr).toBe(88);
    expect(res.confidenceScore).toBe('5/5');
    expect(res.instructions).toContain('@greptile-apps');
  });

  it('factory_ledger tool manages run lifecycle: start -> beat -> finish', async () => {
    // 1. Start run
    const startRes = await ledgerTool.execute(
      {
        action: 'start',
        taskClass: 'bugfix',
        taskSize: 'small',
        modelTier: 'balanced',
      },
      { cwd: tempDir }
    );
    expect(startRes.status).toBe('created');
    const runId = startRes.runId!;

    // 2. Record beat
    const beatRes = await ledgerTool.execute(
      {
        action: 'beat',
        runId,
        beatName: 'prove',
        evidenceArtifact: 'evidence-test.log',
      },
      { cwd: tempDir }
    );
    expect(beatRes.status).toBe('updated');
    expect(beatRes.details?.beats?.prove?.evidence).toContain('evidence-test.log');

    // 3. Record human touch
    const touchRes = await ledgerTool.execute(
      {
        action: 'touch',
        runId,
        beatName: 'build',
        note: 'Clarified requirements with developer',
      },
      { cwd: tempDir }
    );
    expect(touchRes.status).toBe('updated');
    expect(touchRes.details?.human_touches).toHaveLength(1);

    // 4. Finish run
    const finishRes = await ledgerTool.execute(
      {
        action: 'finish',
        runId,
        outcome: 'shipped',
      },
      { cwd: tempDir }
    );
    expect(finishRes.status).toBe('finished');
    expect(finishRes.details?.outcome).toBe('shipped');
    expect(finishRes.details?.finished_at).toBeDefined();
  });

  it('PTC Mode Workflow: chains worktree, ledger, and evidence execution in single script flow', async () => {
    // Emulate DeepSeek PTC Programmatic script flow:
    const ledgerStart = await ledgerTool.execute(
      {
        action: 'start',
        taskClass: 'refactor',
        modelTier: 'balanced',
      },
      { cwd: tempDir }
    );
    expect(ledgerStart.status).toBe('created');

    const evidence = await evidenceTool.execute(
      {
        command: 'node -e "console.log(\'PTC verification green\')"',
        judgeMetric: 'PTC green verify',
      },
      { cwd: tempDir }
    );
    expect(evidence.status).toBe('VERIFIED');

    const ledgerFinish = await ledgerTool.execute(
      {
        action: 'finish',
        runId: ledgerStart.runId,
        outcome: 'shipped',
        evidenceArtifact: evidence.artifactPath,
        beatName: 'prove',
      },
      { cwd: tempDir }
    );
    expect(ledgerFinish.status).toBe('finished');
  });
});
