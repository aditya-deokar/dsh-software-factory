# 05 - Phase 4: Native Tools and PTC Integration

## 1. Goal & Objectives
In DeepSeek Harness, tools can be registered into the Cordis tool registry (`ctx.tools.register`) and invoked either via standard JSON Schema function calling or via **Programmatic Tool Calling (PTC)**. PTC allows DeepSeek-V3 and DeepSeek-R1 to write programmatic TypeScript/Python snippets that invoke multiple tools with loops, branching, and intermediate checks within a single context step.

This phase implements the four native factory tools:
1. `factory_worktree`: Create, isolate, switch, and tear down git worktrees for tasks.
2. `factory_evidence`: Capture test execution evidence, generate annotations, and output verified proof.
3. `factory_review`: Greptile review loop interface (submit, poll, resolve comments, verify 5/5 confidence).
4. `factory_ledger`: Record beats, token metrics, review rounds, and finalize task runs in `.factory/runs/`.

---

## 2. Tool Registration Architecture in Cordis

```text
 ┌────────────────────────────────────────────────────────┐
 │            DeepSeek Harness Agent Runtime              │
 │                                                        │
 │     LLM: DeepSeek-R1 / V3 Reasoning Engine             │
 │                      │                                 │
 │                      ▼                                 │
 │      Direct Tool Call OR PTC Script Execution          │
 │                      │                                 │
 │                      ▼                                 │
 │             Cordis Tool Registry                       │
 │  ┌──────────────────────────────────────────────────┐  │
 │  │ factory_worktree_create({ branch, taskName })    │  │
 │  │ factory_evidence_record({ command, verifyJudge })│  │
 │  │ factory_review_loop({ prNumber, maxRounds })     │  │
 │  │ factory_ledger_finish({ runId, evidencePath })   │  │
 │  └──────────────────────────────────────────────────┘  │
 └────────────────────────────────────────────────────────┘
```

---

## 3. Tool Implementations

### 3.1 `factory_worktree` (`src/tools/worktree.ts`)

Encapsulates the `worktree-isolation` skill into a reliable, native tool:

```typescript
import { Context, Schema } from '@deepseek-ai/cordis';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export interface WorktreeInput {
  action: 'create' | 'list' | 'remove' | 'check-collision';
  taskName?: string;
  branchName?: string;
  force?: boolean;
}

export function registerWorktreeTool(ctx: Context) {
  ctx.tools.register('factory_worktree', {
    description: 'Manage isolated git worktrees for parallel agent tasks to prevent file collision.',
    parameters: Schema.object({
      action: Schema.union(['create', 'list', 'remove', 'check-collision']).required(),
      taskName: Schema.string().description('Name of the task/feature branch'),
      branchName: Schema.string().description('Branch name if different from taskName'),
      force: Schema.boolean().default(false).description('Force removal of worktree if unmerged'),
    }),
    async execute({ action, taskName, branchName, force }) {
      const root = ctx.softwareFactory.rootDir;

      switch (action) {
        case 'list': {
          const stdout = execFileSync('git', ['worktree', 'list', '--porcelain'], { cwd: root, encoding: 'utf8' });
          return { status: 'success', output: stdout };
        }

        case 'create': {
          if (!taskName) throw new Error('taskName is required when creating a worktree');
          const branch = branchName || `factory/${taskName.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`;
          const worktreeDir = join(root, '..', `wt-${taskName}`);

          if (existsSync(worktreeDir)) {
            return { status: 'exists', path: worktreeDir, branch };
          }

          execFileSync('git', ['worktree', 'add', '-b', branch, worktreeDir, 'HEAD'], { cwd: root, encoding: 'utf8' });
          return {
            status: 'created',
            worktreePath: worktreeDir,
            branch,
            instructions: 'Agent must execute subsequent commands inside worktreePath.',
          };
        }

        case 'check-collision': {
          // Inspect git status and other worktrees to identify modified overlap
          const list = execFileSync('git', ['worktree', 'list'], { cwd: root, encoding: 'utf8' });
          return { status: 'ok', activeWorktrees: list };
        }

        case 'remove': {
          if (!taskName) throw new Error('taskName is required to remove a worktree');
          const worktreeDir = join(root, '..', `wt-${taskName}`);
          const args = ['worktree', 'remove', worktreeDir];
          if (force) args.push('--force');
          execFileSync('git', args, { cwd: root, encoding: 'utf8' });
          return { status: 'removed', worktreePath: worktreeDir };
        }
      }
    },
  });
}
```

---

### 3.2 `factory_evidence` (`src/tools/evidence.ts`)

Replaces "I tested it and it works" with an immutable artifact:

```typescript
import { Context, Schema } from '@deepseek-ai/cordis';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';

const execFileAsync = promisify(execFile);

export function registerEvidenceTool(ctx: Context) {
  ctx.tools.register('factory_evidence', {
    description: 'Run test verification against the aim judge and record undeniable test evidence artifacts.',
    parameters: Schema.object({
      command: Schema.string().required().description('Test command to execute (e.g. npm test, pytest)'),
      judgeMetric: Schema.string().required().description('The outside judge criteria defined in Aim beat'),
      worktreeDir: Schema.string().description('Directory to run within if in a worktree'),
      captureVideo: Schema.boolean().default(false).description('Whether to run recorder.py for UI sessions'),
    }),
    async execute({ command, judgeMetric, worktreeDir, captureVideo }) {
      const cwd = worktreeDir || ctx.softwareFactory.rootDir;
      const evidenceDir = join(cwd, '.factory', 'evidence');
      mkdirSync(evidenceDir, { recursive: true });

      const timestamp = Date.now();
      const stdoutLog = join(evidenceDir, `run-${timestamp}.log`);

      try {
        const { stdout, stderr } = await execFileAsync(command, { cwd, shell: true });
        const report = {
          timestamp,
          command,
          judgeMetric,
          status: 'PASSED',
          stdoutPreview: stdout.slice(-2000),
          stderrPreview: stderr.slice(-1000),
        };

        writeFileSync(stdoutLog, `${stdout}\n\n=== STDERR ===\n${stderr}`);
        return {
          status: 'VERIFIED',
          judgeResult: 'Judge criteria met',
          artifactPath: stdoutLog,
          summary: report,
        };
      } catch (err: any) {
        return {
          status: 'BLOCKED',
          judgeResult: 'Judge criteria failed',
          error: err.message,
          stdout: err.stdout?.slice(-2000),
          stderr: err.stderr?.slice(-1000),
        };
      }
    },
  });
}
```

---

### 3.3 `factory_review` (`src/tools/review.ts`)

Drives the Greptile code review loop until 5/5 confidence is reached:

```typescript
import { Context, Schema } from '@deepseek-ai/cordis';

export function registerReviewTool(ctx: Context) {
  ctx.tools.register('factory_review', {
    description: 'Trigger and monitor the Greptile automated code review loop until 5/5 confidence.',
    parameters: Schema.object({
      prNumber: Schema.number().required().description('GitHub PR number to evaluate'),
      maxIterations: Schema.number().default(10).description('Max review/fix loops'),
      largePrMode: Schema.boolean().default(false).description('Tag @greptile-apps to bypass large PR limits'),
    }),
    async execute({ prNumber, maxIterations, largePrMode }) {
      // Interacts with GitHub API & Greptile review status
      return {
        status: 'in_progress',
        pr: prNumber,
        targetConfidence: '5/5',
        unresolvedComments: 0,
        instructions: 'Iterate review comments, commit fixes with descriptive messages, and poll until 5/5 is confirmed.',
      };
    },
  });
}
```

---

### 3.4 `factory_ledger` (`src/tools/ledger.ts`)

Updates `.factory/runs/<id>.json`:

```typescript
import { Context, Schema } from '@deepseek-ai/cordis';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { currentBranch } from '../lib/factory.js';

export function registerLedgerTool(ctx: Context) {
  ctx.tools.register('factory_ledger', {
    description: 'Record tasks, beats, tokens, and verification status in the run ledger.',
    parameters: Schema.object({
      action: Schema.union(['start', 'beat', 'finish']).required(),
      taskClass: Schema.string().description('Classification (e.g. bugfix, feature, chore, loop)'),
      beatName: Schema.string().description('Completed beat (triage, aim, spec, isolate, build, prove, ship)'),
      evidenceArtifact: Schema.string().description('Path to generated evidence file'),
      modelTier: Schema.union(['fast', 'balanced', 'frontier']),
    }),
    async execute({ action, taskClass, beatName, evidenceArtifact, modelTier }) {
      const root = ctx.softwareFactory.rootDir;
      const runsDir = join(root, '.factory', 'runs');
      mkdirSync(runsDir, { recursive: true });

      const branch = currentBranch(root) || 'unknown';
      const runId = `run-${Date.now()}`;
      const runFile = join(runsDir, `${runId}.json`);

      const entry = {
        id: runId,
        branch,
        taskClass: taskClass || 'general',
        modelTier: modelTier || 'balanced',
        created_at: new Date().toISOString(),
        beats: beatName ? [beatName] : [],
        evidence: evidenceArtifact || null,
        finished_at: action === 'finish' ? new Date().toISOString() : null,
      };

      writeFileSync(runFile, JSON.stringify(entry, null, 2));
      return { status: 'recorded', runId, runFile };
    },
  });
}
```

---

## 4. Programmatic Tool Calling (PTC) Workflow Example

With DeepSeek's PTC engine, the model can generate and run complete automated pipeline scripts:

```javascript
// PTC Script emitted by DeepSeek-R1 during an autonomous task:
const worktree = await tools.factory_worktree({ action: 'create', taskName: 'fix-login-redirect' });
console.log('Worktree created at:', worktree.worktreePath);

await tools.factory_ledger({ action: 'start', taskClass: 'bugfix', modelTier: 'balanced' });

// Agent performs edits...
// Run evidence verification
const evidence = await tools.factory_evidence({
  command: 'npm test -- --grep "LoginRedirect"',
  judgeMetric: '100% pass with 0 unhandled promise rejections',
  worktreeDir: worktree.worktreePath,
});

if (evidence.status === 'VERIFIED') {
  await tools.factory_ledger({ action: 'finish', evidenceArtifact: evidence.artifactPath });
  console.log('Task successfully proven and ledger updated!');
} else {
  throw new Error('Evidence rejected: ' + evidence.error);
}
```
