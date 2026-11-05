# 02 - Phase 1: Project Scaffolding and Core Service

## 1. Goal & Objectives
Scaffold the standalone DeepSeek Harness plugin repository `dsh-software-factory`, set up the TypeScript build system and Cordis dependencies, define the Cordis service seam (`SoftwareFactoryService`), declare schema validation, and configure `cordis.yml` for local testing.

---

## 2. Directory Layout

The plugin repository will follow standard Cordis/DSH package conventions:

```text
dsh-software-factory/
├── package.json
├── tsconfig.json
├── cordis.yml                     # Local Harness mounting configuration
├── README.md
├── src/
│   ├── index.ts                   # Plugin entrypoint: apply(ctx, config) & exports
│   ├── service.ts                 # SoftwareFactoryService implementation
│   ├── types.ts                   # Types & Context interface augmentations
│   ├── config.ts                  # Cordis Schema definition for plugin config
│   ├── hooks/                     # Lifecycle hooks and safety interceptors
│   │   ├── index.ts
│   │   ├── session-start.ts       # SessionStart hook logic
│   │   ├── guard-push.ts          # PreToolUse git push safety guard
│   │   └── stop-ledger.ts         # SessionStop ledger validator
│   ├── commands/                  # Slash commands registration
│   │   ├── index.ts
│   │   ├── triage.ts
│   │   ├── aim.ts
│   │   ├── spec.ts
│   │   ├── factory-loop.ts
│   │   ├── factory-report.ts
│   │   └── sidecar.ts
│   ├── tools/                     # Native Cordis tools & PTC bindings
│   │   ├── index.ts
│   │   ├── worktree.ts
│   │   ├── evidence.ts
│   │   ├── review.ts
│   │   └── ledger.ts
│   ├── lib/                       # Core utilities (migrated from software-factory)
│   │   ├── factory.ts             # Workspace discovery, git utils, JSON I/O
│   │   ├── agents-md.ts           # AGENTS.md block parser and idempotent sync
│   │   ├── memory.ts              # Memory index reader, grader, and pruner
│   │   └── routing.ts             # Routing rules evaluation
│   └── ui/                        # Web UI extension definitions (DSH Web)
│       └── panels.ts
└── test/
    ├── service.spec.ts
    ├── guard-push.spec.ts
    ├── session-start.spec.ts
    └── commands.spec.ts
```

---

## 3. Package Configuration (`package.json`)

```json
{
  "name": "dsh-software-factory",
  "version": "1.0.0",
  "description": "DeepSeek Harness plugin for the self-improving Software Factory: triage, spec, worktree isolation, test evidence, Greptile review loop, and autonomous outer loop.",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "type": "module",
  "scripts": {
    "build": "tsup src/index.ts --format esm,cjs --dts --clean",
    "dev": "tsup src/index.ts --format esm,cjs --watch",
    "test": "vitest run",
    "lint": "eslint src/ --ext .ts"
  },
  "keywords": [
    "deepseek",
    "deepseek-harness",
    "dsh-plugin",
    "cordis",
    "cordis-plugin",
    "software-factory",
    "agent-skills",
    "code-review",
    "worktree"
  ],
  "author": "Aditya Deokar",
  "license": "MIT",
  "peerDependencies": {
    "@deepseek-ai/cordis": "^3.0.0"
  },
  "devDependencies": {
    "@deepseek-ai/cordis": "^3.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

---

## 4. TypeScript Configuration & Context Augmentation

In Cordis, services are exposed through Context augmentation. This allows any consumer to access `ctx.softwareFactory` with full type safety and IDE autocomplete.

### `src/types.ts`
```typescript
import { Context, Service } from '@deepseek-ai/cordis';

declare module '@deepseek-ai/cordis' {
  interface Context {
    softwareFactory: SoftwareFactoryService;
  }

  interface Events {
    'factory/run-started'(runId: string, branch: string): void;
    'factory/run-finished'(runId: string, summary: Record<string, any>): void;
    'factory/memory-graduated'(factId: string, skillTarget: string): void;
  }
}

export interface SoftwareFactoryConfig {
  enabled: boolean;
  autoSyncAgentsMd: 'auto' | 'notify' | 'off';
  defaultRoutingTier: 'fast' | 'balanced' | 'frontier';
  enforceWorktreeIsolation: boolean;
  guardGitPush: boolean;
  memoryBudgetTokens: number;
}
```

---

## 5. Configuration Schema (`src/config.ts`)

Cordis provides a declarative Schema DSL (`Schema`) which powers DSH Web UI configuration forms and CLI validator:

```typescript
import { Schema } from '@deepseek-ai/cordis';
import { SoftwareFactoryConfig } from './types.js';

export const Config: Schema<SoftwareFactoryConfig> = Schema.object({
  enabled: Schema.boolean()
    .default(true)
    .description('Enable or disable Software Factory features in this profile.'),
  autoSyncAgentsMd: Schema.union(['auto', 'notify', 'off'])
    .default('auto')
    .description('How to synchronize the factory section in AGENTS.md.'),
  defaultRoutingTier: Schema.union(['fast', 'balanced', 'frontier'])
    .default('balanced')
    .description('Default model tier if not specified by task classification.'),
  enforceWorktreeIsolation: Schema.boolean()
    .default(true)
    .description('Ensure tasks work inside dedicated git worktrees.'),
  guardGitPush: Schema.boolean()
    .default(true)
    .description('Block unleased force-pushes and pushes directly targeting main/master branches.'),
  memoryBudgetTokens: Schema.number()
    .default(4096)
    .description('Token budget allocated for memory index injection during session start.'),
});
```

---

## 6. Core Service Implementation (`src/service.ts`)

```typescript
import { Context, Service } from '@deepseek-ai/cordis';
import { SoftwareFactoryConfig } from './types.js';
import { findRepoRoot } from './lib/factory.js';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

export class SoftwareFactoryService extends Service {
  public rootDir: string;
  public factoryDir: string;
  public isFactoryRepo: boolean;

  constructor(ctx: Context, public config: SoftwareFactoryConfig) {
    super(ctx, 'softwareFactory', true); // Third param indicates immediate availability

    this.rootDir = findRepoRoot(process.cwd());
    this.factoryDir = join(this.rootDir, '.factory');
    this.isFactoryRepo = existsSync(this.factoryDir);
  }

  override start() {
    this.ctx.logger.info(`Software Factory service initialized for workspace: ${this.rootDir}`);
    if (this.isFactoryRepo) {
      this.ctx.logger.info('Detected active .factory/ directory. Factory rules active.');
    }
  }

  override stop() {
    this.ctx.logger.info('Software Factory service shutting down.');
  }

  public refreshState(workspacePath: string) {
    this.rootDir = findRepoRoot(workspacePath);
    this.factoryDir = join(this.rootDir, '.factory');
    this.isFactoryRepo = existsSync(this.factoryDir);
  }
}
```

---

## 7. Mounting in DeepSeek Harness (`cordis.yml`)

To test locally or install into a DSH profile:

```yaml
# cordis.yml
plugins:
  - name: ./dist/index.js
    config:
      enabled: true
      autoSyncAgentsMd: auto
      defaultRoutingTier: balanced
      guardGitPush: true
```

Or via the DSH CLI:
```bash
dsh plugin add ./path/to/dsh-software-factory
```
