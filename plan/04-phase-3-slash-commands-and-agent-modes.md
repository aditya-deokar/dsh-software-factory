# 04 - Phase 3: Slash Commands and Agent Modes

## 1. Goal & Objectives
DeepSeek Harness supports conversational slash commands registered through Cordis (`ctx.command(...)`) and specialized agent modes (such as Creator Mode, Coding Mode, and Custom Subagents). This phase implements the six Software Factory commands:
- `/triage <issue>`: One decision per issue (`implement`, `spec`, `duplicate`, `needs-info`, `decline`).
- `/aim <task>`: Felix Rieseberg's three types of ambition (Altitude, Depth, Range), 3-rung ladder, and named judge before code.
- `/spec <issue>`: Formal product and tech spec opened as a PR (`factory:spec`) before code starts.
- `/factory-loop [--since 14d]`: Autonomous outer loop cycle (signals, diagnosis, proposal, skill PR).
- `/factory-report [window]`: Run ledger metrics and friction report summary.
- `/sidecar <question>`: Spawns an isolated, read-only subagent with a strict non-destructive contract.

---

## 2. Command Architecture in Cordis

Cordis registers slash commands via `ctx.command(name, desc)`. Each command can accept positional arguments, options, custom validators, and interact directly with the active session's conversation stream and subagent factory.

```text
 User types: /aim "Add OAuth2 authentication"
                    │
                    ▼
          Cordis Command Router
                    │
                    ▼
       ctx.command('factory/aim')
                    │
                    ├─ Load prompt skill: skills/ambition-engine/SKILL.md
                    ├─ Inject memory facts relevant to Auth
                    ├─ Direct DeepSeek-R1 / V3 reasoning chain
                    └─ Format Ambition Ladder & Output Result
```

---

## 3. Implementation of the Six Core Commands

### 3.1 `/triage` (`src/commands/triage.ts`)

```typescript
import { Context } from '@deepseek-ai/cordis';

export function registerTriageCommand(ctx: Context) {
  ctx.command('factory/triage <target:text>', 'Triage an issue into exactly one decision')
    .alias('/triage')
    .action(async ({ session }, target) => {
      if (!target) {
        return 'Please specify an issue number, URL, or pasted report to triage.';
      }

      await session.sendPrompt({
        role: 'system',
        content: `You are executing the Software Factory issue-triage beat.
1. Classify the issue into exactly ONE decision: implement, spec, duplicate, needs-info, or decline.
2. Search .factory/memory/ and closed issues before deciding.
3. Apply the corresponding factory:* label and post one comment with the reason.
4. Record the run using run-ledger. Do NOT begin implementation during triage.`,
      });

      return `Starting triage for: ${target}`;
    });
}
```

---

### 3.2 `/aim` (`src/commands/aim.ts`)

```typescript
import { Context } from '@deepseek-ai/cordis';

export function registerAimCommand(ctx: Context) {
  ctx.command('factory/aim [target:text]', 'Raise a task\'s target before building it')
    .alias('/aim')
    .action(async ({ session }, target) => {
      const input = target || 'the most recent task discussed';

      await session.sendPrompt({
        role: 'system',
        content: `You are executing the Software Factory ambition-engine beat for: "${input}".
Follow Felix Rieseberg's types of ambition:
- Altitude: Goal beyond the goal as a 3-rung ladder.
- Depth: Professional standard from raw data.
- Range: Cross-domain methods applied, not simulated.

Rule:
1. Name an outside judge BEFORE any code is written.
2. The current PR takes exactly ONE rung that fits the task size.
3. Rungs above it must be filed as separate follow-up issues, not implemented now.
4. Conclude with a clear rewritten prompt and STOP.`,
      });

      return `Calculating ambition ladder and judge for: ${input}`;
    });
}
```

---

### 3.3 `/spec` (`src/commands/spec.ts`)

```typescript
import { Context } from '@deepseek-ai/cordis';

export function registerSpecCommand(ctx: Context) {
  ctx.command('factory/spec <issue:text>', 'Write a product and tech spec, open for review, and stop')
    .alias('/spec')
    .action(async ({ session }, issue) => {
      await session.sendPrompt({
        role: 'system',
        content: `You are executing the Software Factory spec-writing beat for: "${issue}".
1. Put Open Questions at the top, each accompanied by a recommended answer.
2. Write a Product Spec: Invariants, user behavior, and testable acceptance checks.
3. Write a Tech Spec: Boundary vs service split, files to be modified, risks.
4. Open the spec as a PR labeled 'factory:spec'.
5. STOP: Do not write implementation code until a human approves the spec.`,
      });

      return `Drafting spec for: ${issue}`;
    });
}
```

---

### 3.4 `/factory-loop` (`src/commands/factory-loop.ts`)

```typescript
import { Context } from '@deepseek-ai/cordis';

export function registerFactoryLoopCommand(ctx: Context) {
  ctx.command('factory/loop', 'Run the outer loop once to collect signals and propose a skill fix')
    .alias('/factory-loop')
    .option('since', '-s <duration> Time window to analyze (default: 14d)', { default: '14d' })
    .action(async ({ session, options }) => {
      await session.sendPrompt({
        role: 'system',
        content: `You are executing the Software Factory skill-feedback-loop with window: ${options.since}.
1. Work in a fresh isolated worktree (worktree-isolation).
2. Record run with 'run-ledger --class loop'.
3. Run signals collection. If nothing qualifies, report signals table and STOP.
4. If a skill qualifies: diagnose owning skill, write proposal file, make the smallest change to one skill.
5. Open exactly one PR labeled 'factory:skill-loop'. Never auto-merge it.`,
      });

      return `Initiating Software Factory feedback loop (window: ${options.since})...`;
    });
}
```

---

### 3.5 `/factory-report` (`src/commands/factory-report.ts`)

```typescript
import { Context } from '@deepseek-ai/cordis';
import { runLedgerReport, runFrictionReport } from '../lib/factory.js';

export function registerFactoryReportCommand(ctx: Context) {
  ctx.command('factory/report [window:string]', 'Display run ledger and friction reports')
    .alias('/factory-report')
    .action(async ({ session }, window = '14d') => {
      const root = session.workspaceRoot || ctx.softwareFactory.rootDir;
      
      const ledgerData = await runLedgerReport(root, window);
      const frictionData = await runFrictionReport(root, window);

      return [
        `### Software Factory Health Report (${window})`,
        '',
        '#### Run Ledger Metrics:',
        ledgerData.formattedTable || '_No runs recorded in window._',
        '',
        '#### Skill Friction & Correction Frequency:',
        frictionData.formattedTable || '_No transcript friction recorded._',
        '',
        '#### Key Observations:',
        ...ledgerData.observations.map((obs) => `- ${obs}`),
      ].join('\n');
    });
}
```

---

### 3.6 `/sidecar` Subagent Protocol (`src/commands/sidecar.ts`)

DeepSeek Harness provides native subagent spawning via `ctx.agent` / `ctx.session.spawnSubagent`. The `/sidecar` command launches an isolated read-only investigator:

```typescript
import { Context } from '@deepseek-ai/cordis';

export function registerSidecarCommand(ctx: Context) {
  ctx.command('factory/sidecar <question:text>', 'Spawn a read-only investigator subagent')
    .alias('/sidecar')
    .action(async ({ session }, question) => {
      if (!question) return 'Please provide a question for the sidecar to investigate.';

      const contract = `You are a read-only investigator in this repository. Investigate and report.
Do not fix anything, however small or obvious.

Question: ${question}

You may: read any file, search, run read-only git commands (status, log, diff, show, blame), run existing tests, and read logs.
You may not: create, edit, or delete files; run formatters or autofixers; switch, create, reset, rebase, or stash branches; add worktrees; push, comment on, approve, or merge anything on GitHub.

Report:
1. The answer in 2-3 sentences.
2. The evidence (file:line, command output).
3. What you could not determine and what would settle it.`;

      // Spawn child session with sandboxed permissions
      const childSession = await session.spawnSubagent({
        role: 'sidecar-investigator',
        tier: 'balanced', // uses DeepSeek-V3 or balanced model
        readOnly: true,
        systemPrompt: contract,
      });

      const response = await childSession.execute(question);
      return `**[Sidecar Report]**\n\n${response.content}`;
    });
}
```
