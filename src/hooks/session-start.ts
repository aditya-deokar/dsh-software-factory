import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { currentBranch, listFiles, readJson } from '../lib/factory.js';
import { planAgentsMd, loadTemplates } from '../lib/agents-md.js';
import type { SoftwareFactoryConfig } from '../types.js';

export interface SessionContextData {
  systemPromptAdditions: string[];
  warningNotice?: string;
  openRuns: string[];
}

/**
 * Executes Software Factory session-start logic:
 * 1. Checks for .factory/
 * 2. Syncs AGENTS.md if configured
 * 3. Injects .factory/memory/INDEX.md (capped at budget)
 * 4. Injects .factory/routing.json policy
 * 5. Discovers any open runs on current task branch
 */
export function buildSessionStartContext(
  workspaceRoot: string,
  config: SoftwareFactoryConfig,
  assetsDir?: string
): SessionContextData {
  const dir = join(workspaceRoot, '.factory');
  const result: SessionContextData = {
    systemPromptAdditions: [],
    openRuns: [],
  };

  // If no .factory/ directory, fail open (exit without adding rules)
  if (!existsSync(dir)) {
    return result;
  }

  const out: string[] = [
    '### Software Factory Active Context',
    'This repository is governed by the Software Factory workflow. Follow AGENTS.md; record the run with run-ledger.',
  ];

  // 1. AGENTS.md sync check
  try {
    const factoryConfig = existsSync(join(dir, 'config.json')) ? readJson(join(dir, 'config.json')) : {};
    const syncMode = factoryConfig.agents_md || config.autoSyncAgentsMd || 'auto';
    const agentsMdFile = join(workspaceRoot, 'AGENTS.md');

    if (syncMode !== 'off' && existsSync(agentsMdFile)) {
      const templates = loadTemplates(assetsDir);
      const plan = planAgentsMd(readFileSync(agentsMdFile, 'utf8'), templates);

      if (plan.action === 'update' || plan.action === 'migrate') {
        if (syncMode === 'auto' && plan.text) {
          writeFileSync(agentsMdFile, plan.text);
          out.push(
            `- **Notice**: Automatically synced the software factory block in AGENTS.md (${plan.from} -> ${plan.to}). Commit this change separately.`
          );
        } else {
          result.warningNotice = `AGENTS.md: the software factory block is ${plan.from}; ${plan.to} is installed. Update recommended.`;
          out.push(`- **Warning**: ${result.warningNotice}`);
        }
      } else if (plan.action === 'edited' || plan.action === 'legacy-edited') {
        result.warningNotice = `AGENTS.md: the software factory block was edited by hand (${plan.from}). Keep repo rules outside markers.`;
        out.push(`- **Notice**: ${result.warningNotice}`);
      }
    }
  } catch {
    // A sync issue must never disrupt memory loading
  }

  // 2. Memory Index Injection
  const memoryIndexFile = join(dir, 'memory', 'INDEX.md');
  if (existsSync(memoryIndexFile)) {
    const text = readFileSync(memoryIndexFile, 'utf8').trim();
    const budget = config.memoryBudgetTokens || 4096;
    const truncated = text.length > budget ? `${text.slice(0, budget)}\n...(index truncated; run memory prune)` : text;
    out.push('', '#### Project Memories & Invariants (INDEX.md):', truncated);
  }

  // 3. Routing Policy
  const routingFile = join(dir, 'routing.json');
  if (existsSync(routingFile)) {
    const r = readJson<{ default?: string; rules?: unknown[] }>(routingFile);
    out.push('', `Routing: default tier ${r.default || 'balanced'}, ${r.rules?.length || 0} active rules in .factory/routing.json.`);
  }

  // 4. Open Runs on Current Branch
  const branch = currentBranch(workspaceRoot);
  if (branch) {
    const runsDir = join(dir, 'runs');
    const open = listFiles(runsDir, '.json')
      .map((f) => readJson<{ id: string; branch?: string; finished_at?: string }>(f))
      .filter((run) => !run.finished_at && run.branch === branch);

    if (open.length > 0) {
      result.openRuns = open.map((r) => r.id);
      out.push(
        '',
        `#### Active Run in Progress:`,
        `Branch "${branch}" has open run(s): ${result.openRuns.join(', ')}. Use ledger tools to record progress.`
      );
    }
  }

  result.systemPromptAdditions = out;
  return result;
}
