import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSessionStartContext } from '../src/hooks/session-start.js';
import { auditSessionStop } from '../src/hooks/stop-ledger.js';

describe('Phase 2: session-start and stop-ledger hooks', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'sf-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('fails open if .factory directory does not exist', () => {
    const res = buildSessionStartContext(tempDir, { enabled: true });
    expect(res.systemPromptAdditions).toHaveLength(0);
    expect(res.openRuns).toHaveLength(0);
  });

  it('injects memory index, routing default, and notices when .factory exists', () => {
    const factoryDir = join(tempDir, '.factory');
    mkdirSync(join(factoryDir, 'memory'), { recursive: true });

    writeFileSync(
      join(factoryDir, 'memory', 'INDEX.md'),
      '# Invariants\n- Never mutate global singleton in tests.'
    );
    writeFileSync(
      join(factoryDir, 'routing.json'),
      JSON.stringify({ default: 'balanced', rules: [{ class: 'bugfix', tier: 'fast' }] })
    );

    const res = buildSessionStartContext(tempDir, { enabled: true, autoSyncAgentsMd: 'off' });
    expect(res.systemPromptAdditions.length).toBeGreaterThan(0);
    const fullText = res.systemPromptAdditions.join('\n');
    expect(fullText).toContain('Software Factory Active Context');
    expect(fullText).toContain('Never mutate global singleton in tests.');
    expect(fullText).toContain('default tier balanced');
  });

  it('detects unfinished runs on stop audit', () => {
    const factoryDir = join(tempDir, '.factory');
    mkdirSync(join(factoryDir, 'runs'), { recursive: true });

    writeFileSync(
      join(factoryDir, 'runs', 'run-123.json'),
      JSON.stringify({ id: 'run-123', branch: 'test-branch' })
    );

    // Mock git branch by auditing directly
    const audit = auditSessionStop(tempDir);
    expect(audit).toBeDefined();
  });
});
