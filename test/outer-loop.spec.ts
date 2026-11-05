import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MemoryEngine } from '../src/lib/memory.js';
import { resolveModelTier } from '../src/lib/routing.js';
import { analyzeFrictionSignals, formulateFeedbackProposal } from '../src/lib/feedback.js';

describe('Phase 5: Software Factory Outer Loop, Memory & Feedback', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'sf-outer-loop-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('MemoryEngine: records fact, searches, and updates INDEX.md', () => {
    const memoryDir = join(tempDir, 'memory');
    const memory = new MemoryEngine(memoryDir);

    const fact = memory.recordFact('auth-jwt-rotation', 'JWT refresh tokens must rotate on reuse', 'docs/security.md', [
      'auth',
      'jwt',
    ]);
    expect(fact.timesUsed).toBe(1);

    const indexFile = join(memoryDir, 'INDEX.md');
    expect(existsSync(indexFile)).toBe(true);
    const indexContent = readFileSync(indexFile, 'utf8');
    expect(indexContent).toContain('auth-jwt-rotation');
    expect(indexContent).toContain('JWT refresh tokens must rotate on reuse');

    const search = memory.searchFacts('rotate');
    expect(search).toHaveLength(1);
    expect(search[0].id).toBe('auth-jwt-rotation');
  });

  it('MemoryEngine: graduates fact into candidate skill after 3 uses', () => {
    const memoryDir = join(tempDir, 'memory');
    const memory = new MemoryEngine(memoryDir);

    memory.recordFact('db-connection-pool', 'Never create multiple pool instances in worker', 'src/db.ts');
    memory.recordUse('db-connection-pool');
    memory.recordUse('db-connection-pool'); // 3rd usage

    const gradFile = join(memoryDir, 'GRADUATE.md');
    expect(existsSync(gradFile)).toBe(true);
    const gradContent = readFileSync(gradFile, 'utf8');
    expect(gradContent).toContain('db-connection-pool');
    expect(gradContent).toContain('used 3 times');
  });

  it('Dynamic Model Routing: maps task classes and complexity limits', () => {
    const fastTier = resolveModelTier('typo', 5);
    expect(fastTier.tier).toBe('fast');
    expect(fastTier.modelId).toContain('deepseek-v3');

    const balancedTier = resolveModelTier('bugfix', 150);
    expect(balancedTier.tier).toBe('balanced');
    expect(balancedTier.modelId).toContain('deepseek-r1');

    const frontierTier = resolveModelTier('refactor', 800);
    expect(frontierTier.tier).toBe('frontier');
  });

  it('Skill Feedback Loop: analyzes friction and formulates surgical repair proposal', () => {
    const runsDir = join(tempDir, 'runs');
    mkdirSync(runsDir, { recursive: true });

    // Emulate 3 runs with corrections on spec beat
    for (let i = 1; i <= 3; i++) {
      writeFileSync(
        join(runsDir, `run-${i}.json`),
        JSON.stringify({
          id: `run-${i}`,
          human_touches: [
            {
              kind: 'correction',
              beat: 'spec',
              note: `Missing acceptance criteria in step ${i}`,
            },
          ],
        })
      );
    }

    const signals = analyzeFrictionSignals(runsDir);
    expect(signals.length).toBeGreaterThan(0);
    const specSignal = signals.find((s) => s.skillName === 'spec-writing');
    expect(specSignal).toBeDefined();
    expect(specSignal?.correctionCount).toBe(3);

    const proposal = formulateFeedbackProposal(signals, 2);
    expect(proposal).not.toBeNull();
    expect(proposal?.qualifyingSkill).toBe('spec-writing');
    expect(proposal?.proposalDraft).toContain('Skill Feedback Proposal: spec-writing');
    expect(proposal?.targetMetricGoal).toContain('Target: 0 friction events');
  });
});
