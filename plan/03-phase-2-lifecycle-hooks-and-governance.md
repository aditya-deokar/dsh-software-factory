# 03 - Phase 2: Lifecycle Hooks and Governance

## 1. Goal & Objectives
In Software Factory, safety and governance are not mere prompt suggestions—they are enforced at runtime via hooks. This phase migrates and enhances the three critical hooks from `aditya-deokar/software-factory` into native Cordis lifecycle events and middleware:
1. **`SessionStart` Interceptor**: Injects `.factory/memory/INDEX.md`, active routing tiers, and open run IDs into the model's session context, and auto-syncs `AGENTS.md`.
2. **`PreToolUse` Guard (`guard-push`)**: Intercepts shell tool executions to block direct pushes to `main`/`master` and unleased force pushes (`--force`).
3. **`SessionStop` / `BeforeStop` Hook (`stop-ledger`)**: Ensures open runs are cleanly finished and logged before a session terminates.

---

## 2. Cordis Lifecycle Architecture

Cordis uses an asynchronous, typed event emitter pattern (`ctx.on()`) combined with middleware chains (`ctx.middleware()` or tool interceptors).

```text
       Session Creation
              │
              ▼
    ctx.on('session/start')
    ├── Check for .factory/
    ├── Auto-sync AGENTS.md (if config.autoSyncAgentsMd !== 'off')
    ├── Read .factory/memory/INDEX.md (budget-capped)
    ├── Read .factory/routing.json
    └── Append System Prompt Context
              │
              ▼
       Agent Execution Loop (User / Model Interaction)
              │
      Agent calls Tool (e.g. bash / terminal / execute)
              │
              ▼
    ctx.on('tool/before-call') [Middleware Guard]
    ├── Inspect command line
    ├── Detect git push syntax
    ├── Check target branch (main/master)
    ├── Check force flags (--force without --force-with-lease)
    └── BLOCK (throw error/exit 2) OR ALLOW
              │
              ▼
       Session Termination (User leaves / task completed)
              │
              ▼
    ctx.on('session/before-stop')
    ├── Scan .factory/runs/ for unfinished runs on current branch
    └── Warn or require completion ledger entry
```

---

## 3. Detailed Hook Implementation

### 3.1 SessionStart Context Injection (`src/hooks/session-start.ts`)

When a DSH session initializes, this hook inspects the active workspace root. If `.factory/` is detected, it prepares structured context for the DeepSeek model.

```typescript
import { Context } from '@deepseek-ai/cordis';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { currentBranch, listFiles, readJson } from '../lib/factory.js';
import { planAgentsMd, loadTemplates } from '../lib/agents-md.js';

export function registerSessionStartHook(ctx: Context) {
  ctx.on('session/start', async (session) => {
    const root = session.workspaceRoot || ctx.softwareFactory.rootDir;
    const dir = join(root, '.factory');

    // If .factory does not exist, do nothing (fails open)
    if (!existsSync(dir)) return;

    const out: string[] = [
      '### Software Factory Active Context',
      'This repository is governed by the Software Factory loop. Follow the beats in AGENTS.md.',
    ];

    // 1. AGENTS.md sync check
    try {
      const config = existsSync(join(dir, 'config.json')) ? readJson(join(dir, 'config.json')) : {};
      const syncMode = config.agents_md || ctx.softwareFactory.config.autoSyncAgentsMd;
      const agentsMdFile = join(root, 'AGENTS.md');

      if (syncMode !== 'off' && existsSync(agentsMdFile)) {
        const templates = loadTemplates();
        const plan = planAgentsMd(readFileSync(agentsMdFile, 'utf8'), templates);
        if (plan.action === 'update' || plan.action === 'migrate') {
          if (syncMode === 'auto') {
            writeFileSync(agentsMdFile, plan.text);
            out.push(`- **Notice**: Automatically synced the software factory section in AGENTS.md (${plan.from} -> ${plan.to}).`);
          } else {
            out.push(`- **Warning**: AGENTS.md factory section is outdated (${plan.from} vs ${plan.to}). Run sync to update.`);
          }
        }
      }
    } catch (err) {
      ctx.logger.warn('Failed to sync AGENTS.md:', err);
    }

    // 2. Memory Index Injection (Capped at budget, default 4096 chars/tokens)
    const memoryIndexFile = join(dir, 'memory', 'INDEX.md');
    if (existsSync(memoryIndexFile)) {
      const text = readFileSync(memoryIndexFile, 'utf8').trim();
      const budget = ctx.softwareFactory.config.memoryBudgetTokens;
      const truncated = text.length > budget ? `${text.slice(0, budget)}\n...(index truncated; run memory prune)` : text;
      out.push('', '#### Project Memories & Invariants (INDEX.md):', truncated);
    }

    // 3. Routing Tier Defaults
    const routingFile = join(dir, 'routing.json');
    if (existsSync(routingFile)) {
      const r = readJson(routingFile);
      out.push('', `#### Routing Policy: Default tier: \`${r.default}\`, ${r.rules?.length || 0} active rules.`);
    }

    // 4. Open Runs on Current Branch
    const branch = currentBranch(root);
    if (branch) {
      const openRuns = listFiles(join(dir, 'runs'), '.json')
        .map((f) => readJson(f))
        .filter((run) => !run.finished_at && run.branch === branch);

      if (openRuns.length) {
        out.push(
          '',
          `#### Active Run in Progress:`,
          `Branch \`${branch}\` has open run: ${openRuns.map((r) => r.id).join(', ')}. Use ledger tools to record progress.`
        );
      }
    }

    // Inject directly into DSH Session context
    session.addSystemPromptSection('software-factory', out.join('\n'));
  });
}
```

---

### 3.2 PreToolUse Safety Guard (`src/hooks/guard-push.ts`)

Prevents catastrophic git operations:
- Forbids pushes to protected branches (`main`, `master`).
- Blocks bare `--force` (demands `--force-with-lease`).
- Blocks `--mirror` and `--all` which unintentionally push master/main.

```typescript
import { Context } from '@deepseek-ai/cordis';
import { currentBranch } from '../lib/factory.js';
import { resolve } from 'node:path';

const PROTECTED = new Set(['main', 'master', 'release', 'production']);

export function commands(line: string): string[][] {
  return String(line)
    .split(/&&|\|\||[;|\n]/)
    .map((c) => (c.match(/"[^"]*"|'[^']*'|\S+/g) || []).map((t) => t.replace(/^["']|["']$/g, '')));
}

export function checkPush(line: string, { cwd = process.cwd(), branchOf = currentBranch } = {}): string | null {
  for (const tokens of commands(line)) {
    const g = tokens.findIndex((t) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(t));
    if (g < 0 || tokens[g] !== 'git') continue;

    let i = g + 1;
    let dir = cwd;
    while (i < tokens.length && tokens[i].startsWith('-')) {
      if (tokens[i] === '-C') dir = resolve(cwd, tokens[++i] || '.');
      else if (tokens[i] === '-c') i++;
      i++;
    }

    if (tokens[i] !== 'push') continue;
    const args = tokens.slice(i + 1);

    const hasLease = args.some((a) => a.startsWith('--force-with-lease'));
    const plainForce = args.some((a) => a === '--force' || /^-[a-zA-Z]*f[a-zA-Z]*$/.test(a));
    if (plainForce && !hasLease) {
      return 'Plain --force is strictly forbidden. Use --force-with-lease, and only on your isolated task branch.';
    }

    if (args.includes('--mirror') || args.includes('--all')) {
      return '--all and --mirror push the default branch too. Push your task branch by name.';
    }

    const positional = args.filter((a) => !a.startsWith('-'));
    const refspecs = positional.slice(1);
    for (const spec of refspecs) {
      if (spec.startsWith('+')) {
        return `"${spec}" force-pushes without safety. Use --force-with-lease on your own branch instead.`;
      }
      const dest = (spec.includes(':') ? spec.split(':').pop()! : spec).replace(/^refs\/heads\//, '');
      if (PROTECTED.has(dest)) {
        return `Direct push to protected branch "${dest}" is blocked by Software Factory guard. Work in a task branch and open a PR.`;
      }
    }

    if (!refspecs.length) {
      const branch = branchOf(dir);
      if (branch && PROTECTED.has(branch)) {
        return `You are currently on protected branch "${branch}"; a bare git push would update it. Switch to a task branch first.`;
      }
    }
  }
  return null;
}

export function registerGuardPushHook(ctx: Context) {
  if (!ctx.softwareFactory.config.guardGitPush) return;

  ctx.on('tool/before-call', async (event) => {
    // Intercept bash/terminal tool invocations
    if (['bash', 'terminal', 'shell', 'exec', 'execute'].includes(event.toolName)) {
      const cmd = event.args?.command || event.args?.code;
      if (cmd && typeof cmd === 'string' && /\bgit\b[\s\S]*\bpush\b/.test(cmd)) {
        const violation = checkPush(cmd, { cwd: event.cwd || process.cwd() });
        if (violation) {
          ctx.logger.error(`[GuardPush] Blocked dangerous command: ${violation}`);
          throw new Error(`[Software Factory Guard] Command blocked: ${violation}`);
        }
      }
    }
  });
}
```

---

### 3.3 SessionStop / Run Ledger Verifier (`src/hooks/stop-ledger.ts`)

Prevents tasks from being abandoned without recording an outcome, tokens used, or test evidence:

```typescript
import { Context } from '@deepseek-ai/cordis';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { currentBranch, listFiles, readJson } from '../lib/factory.js';

export function registerStopLedgerHook(ctx: Context) {
  ctx.on('session/before-stop', async (session) => {
    const root = session.workspaceRoot || ctx.softwareFactory.rootDir;
    const runsDir = join(root, '.factory', 'runs');
    if (!existsSync(runsDir)) return;

    const branch = currentBranch(root);
    if (!branch) return;

    const unfinished = listFiles(runsDir, '.json')
      .map((f) => readJson(f))
      .filter((run) => !run.finished_at && run.branch === branch);

    if (unfinished.length > 0) {
      session.sendWarning(
        `[Software Factory] Task branch "${branch}" has ${unfinished.length} unfinished run ledger(s): ${unfinished
          .map((u) => u.id)
          .join(', ')}. Remember to call 'factory_ledger_finish' to record completion and evidence.`
      );
    }
  });
}
```
