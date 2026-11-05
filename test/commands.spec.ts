import { describe, it, expect, vi } from 'vitest';
import {
  triageCommand,
  aimCommand,
  specCommand,
  factoryLoopCommand,
  factoryReportCommand,
  sidecarCommand,
} from '../src/commands/index.js';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('Phase 3: Software Factory Slash Commands', () => {
  it('triage command prompts agent loop with 5 standard decisions', async () => {
    const sendPrompt = vi.fn();
    const ctx = { session: { sendPrompt } };

    const output = await triageCommand.action(ctx, 'issue #42: login fails on safari');
    expect(output).toContain('Initiated issue triage for: issue #42');
    expect(sendPrompt).toHaveBeenCalledOnce();
    const promptArg = sendPrompt.mock.calls[0][0];
    expect(promptArg.content).toContain('Make exactly ONE decision:');
    expect(promptArg.content).toContain('- implement');
    expect(promptArg.content).toContain('- spec');
    expect(promptArg.content).toContain('- duplicate');
    expect(promptArg.content).toContain('- needs-info');
    expect(promptArg.content).toContain('- decline');
  });

  it('triage returns error hint when no target is provided', async () => {
    const output = await triageCommand.action({});
    expect(output).toContain('Please specify an issue number');
  });

  it('aim command generates 3-rung ambition ladder prompt', async () => {
    const sendPrompt = vi.fn();
    const ctx = { session: { sendPrompt } };

    const output = await aimCommand.action(ctx, 'add prometheus metrics');
    expect(output).toContain('Configured ambition engine');
    expect(sendPrompt).toHaveBeenCalledOnce();
    const promptArg = sendPrompt.mock.calls[0][0];
    expect(promptArg.content).toContain('Altitude');
    expect(promptArg.content).toContain('Depth');
    expect(promptArg.content).toContain('Range');
    expect(promptArg.content).toContain('Name an OUTSIDE JUDGE before writing any code');
  });

  it('spec command prompts product & tech spec gates', async () => {
    const sendPrompt = vi.fn();
    const ctx = { session: { sendPrompt } };

    const output = await specCommand.action(ctx, 'user billing portal');
    expect(output).toContain('Drafting formal product & tech spec');
    expect(sendPrompt).toHaveBeenCalledOnce();
    const promptArg = sendPrompt.mock.calls[0][0];
    expect(promptArg.content).toContain('Open Questions at the top');
    expect(promptArg.content).toContain('Product Spec:');
    expect(promptArg.content).toContain('Tech Spec:');
    expect(promptArg.content).toContain('Implementation code strictly waits for a human to approve');
  });

  it('factory-loop command enforces isolated worktree and never-auto-merge rule', async () => {
    const sendPrompt = vi.fn();
    const ctx = { session: { sendPrompt } };

    const output = await factoryLoopCommand.action(ctx, '--since', '7d');
    expect(output).toContain('Initiated Software Factory outer feedback loop');
    expect(sendPrompt).toHaveBeenCalledOnce();
    const promptArg = sendPrompt.mock.calls[0][0];
    expect(promptArg.content).toContain('worktree-isolation');
    expect(promptArg.content).toContain('run-ledger --class loop');
    expect(promptArg.content).toContain('NEVER auto-merge the loop PR');
  });

  it('sidecar command returns read-only investigator contract', async () => {
    const spawnSubagent = vi.fn().mockResolvedValue({
      execute: vi.fn().mockResolvedValue({ content: 'Investigation complete: no leaks detected.' }),
    });
    const ctx = { session: { spawnSubagent } };

    const output = await sidecarCommand.action(ctx, 'Why is memory leaking in tests?');
    expect(spawnSubagent).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'sidecar-investigator',
        tier: 'balanced',
        readOnly: true,
      })
    );
    expect(output).toContain('Investigation complete: no leaks detected.');
  });

  it('factory-report command computes ledger metrics and outputs markdown', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'sf-report-test-'));
    const runsDir = join(tempDir, '.factory', 'runs');
    mkdirSync(runsDir, { recursive: true });

    writeFileSync(
      join(runsDir, 'run-1.json'),
      JSON.stringify({
        id: 'run-1',
        outcome: 'shipped',
        task: { class: 'bugfix' },
        beats: { ship: {}, prove: { evidence: ['log.txt'] } },
        human_touches: [{ kind: 'correction', beat: 'build' }],
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
      })
    );

    const ctx = { session: { workspaceRoot: tempDir } };
    const rep = await factoryReportCommand.action(ctx, '14d');
    expect(rep).toContain('Software Factory Report');
    expect(rep).toContain('Total Runs');
    expect(rep).toContain('shipped: 1');
    expect(rep).toContain('bugfix: 1');
    expect(rep).toContain('1 corrections');

    rmSync(tempDir, { recursive: true, force: true });
  });
});
