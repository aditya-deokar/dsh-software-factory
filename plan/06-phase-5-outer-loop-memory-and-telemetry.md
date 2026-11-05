# 06 - Phase 5: Outer Loop, Memory, and Telemetry

## 1. Goal & Objectives
The signature breakthrough of Software Factory v3 is the **self-improving outer loop**. When agents make repeated mistakes or human developers repeatedly correct them, that friction is recorded, mapped to the responsible skill, and used to autonomously author a targeted pull request to improve the skill.

This phase implements:
1. **Agent Memory Engine (`.factory/memory/`)**: Add, search, prune, and graduate facts (graduating into skills when used $\ge 3$ times).
2. **Dynamic Model Routing (`.factory/routing.json`)**: Map task classes and complexity tiers (`fast`, `balanced`, `frontier`) to model providers.
3. **Run Ledger Telemetry (`.factory/runs/`)**: Cost calculation, beat tracking, and metrics aggregation.
4. **Autonomous Skill Feedback Loop**: Collect signals, pinpoint failing skills, and generate skill repair PRs.

---

## 2. Outer Loop Architecture

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      Software Factory Outer Loop                       │
 │                                                                        │
 │  ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐ │
 │  │   Run Ledger    │      │  Agent Memory   │      │  Model Routing  │ │
 │  │ .factory/runs/  │      │.factory/memory/ │      │ .factory/       │ │
 │  │ Records tokens, │      │ Stores facts    │      │ routing.json    │ │
 │  │ beats & fixes   │      │ & invariants    │      │ Tier classifier │ │
 │  └────────┬────────┘      └────────┬────────┘      └────────┬────────┘ │
 │           │                        │                        │          │
 │           └────────────────────────┼────────────────────────┘          │
 │                                    ▼                                   │
 │                    ┌───────────────────────────────┐                   │
 │                    │ collect-signals.ts & friction │                   │
 │                    └───────────────┬───────────────┘                   │
 │                                    ▼                                   │
 │                    ┌───────────────────────────────┐                   │
 │                    │   Diagnose Owning Skill       │                   │
 │                    └───────────────┬───────────────┘                   │
 │                                    ▼                                   │
 │                    ┌───────────────────────────────┐                   │
 │                    │ Formulate Minimal Skill Fix   │                   │
 │                    │ (PR labeled factory:skill-loop│                   │
 │                    └───────────────────────────────┘                   │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Subsystem Implementation

### 3.1 Agent Memory Engine (`src/lib/memory.ts`)

Manages verified facts with source links. Avoids re-learning bugs:

```typescript
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export interface MemoryEntry {
  id: string;
  fact: string;
  source: string;
  timesUsed: number;
  lastUsed: string;
}

export class MemoryEngine {
  constructor(private memoryDir: string) {
    if (!existsSync(memoryDir)) mkdirSync(memoryDir, { recursive: true });
  }

  public recordFact(id: string, fact: string, source: string): void {
    const file = join(this.memoryDir, `${id}.json`);
    const entry: MemoryEntry = {
      id,
      fact,
      source,
      timesUsed: 1,
      lastUsed: new Date().toISOString(),
    };
    writeFileSync(file, JSON.stringify(entry, null, 2));
    this.rebuildIndex();
  }

  public recordUse(id: string): void {
    const file = join(this.memoryDir, `${id}.json`);
    if (!existsSync(file)) return;
    const entry: MemoryEntry = JSON.parse(readFileSync(file, 'utf8'));
    entry.timesUsed += 1;
    entry.lastUsed = new Date().toISOString();
    writeFileSync(file, JSON.stringify(entry, null, 2));

    // Graduation check: used 3 times -> candidate to become a skill rule
    if (entry.timesUsed >= 3) {
      this.flagForGraduation(entry);
    }
  }

  private flagForGraduation(entry: MemoryEntry): void {
    const gradFile = join(this.memoryDir, 'GRADUATE.md');
    const note = `- [ ] Memory \`${entry.id}\` used ${entry.timesUsed} times: "${entry.fact}" (source: ${entry.source})\n`;
    writeFileSync(gradFile, note, { flag: 'a' });
  }

  public rebuildIndex(): void {
    const files = readdirSync(this.memoryDir).filter((f) => f.endsWith('.json'));
    const entries: MemoryEntry[] = files.map((f) => JSON.parse(readFileSync(join(this.memoryDir, f), 'utf8')));

    const lines = [
      '# Software Factory Memory Index',
      'Facts, decisions, and environment invariants. Rebuilt automatically.',
      '',
    ];

    for (const e of entries) {
      lines.push(`- **${e.id}**: ${e.fact} (seen ${e.timesUsed}x, source: ${e.source})`);
    }

    writeFileSync(join(this.memoryDir, 'INDEX.md'), lines.join('\n'));
  }
}
```

---

### 3.2 Dynamic Model Routing (`src/lib/routing.ts`)

DeepSeek Harness supports multiple model configurations. `routing.ts` resolves task classifications to optimal cost tiers:

```typescript
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export type ModelTier = 'fast' | 'balanced' | 'frontier';

export interface RoutingRule {
  class: string;
  maxLinesChanged?: number;
  tier: ModelTier;
}

export interface RoutingConfig {
  default: ModelTier;
  tiers: {
    fast: string;      // e.g. "deepseek/deepseek-v3" or "antigravity/gemini-3.8-flash"
    balanced: string;  // e.g. "deepseek/deepseek-r1" or balanced coding model
    frontier: string;  // e.g. "deepseek/deepseek-r1-heavy" or frontier
  };
  rules: RoutingRule[];
}

export function resolveModelTier(taskClass: string, linesCount: number, factoryDir: string): { tier: ModelTier; modelId: string } {
  const configFile = join(factoryDir, 'routing.json');
  if (!existsSync(configFile)) {
    return { tier: 'balanced', modelId: 'deepseek/deepseek-r1' };
  }

  const config: RoutingConfig = JSON.parse(readFileSync(configFile, 'utf8'));

  for (const rule of config.rules) {
    if (rule.class === taskClass) {
      if (rule.maxLinesChanged && linesCount > rule.maxLinesChanged) {
        continue;
      }
      return { tier: rule.tier, modelId: config.tiers[rule.tier] };
    }
  }

  return { tier: config.default, modelId: config.tiers[config.default] };
}
```

---

### 3.3 Skill Feedback Loop Automation

The feedback loop processes run histories, tallies human interventions or test failures per skill, and drafts a proposed patch:

```typescript
export interface SkillFrictionSignal {
  skillName: string;
  correctionCount: number;
  recentFailureReasons: string[];
}

export async function analyzeFriction(runsDir: string): Promise<SkillFrictionSignal[]> {
  // Aggregate occurrences of agent corrections from .factory/runs/
  return [
    {
      skillName: 'spec-writing',
      correctionCount: 4,
      recentFailureReasons: ['Missing acceptance criteria for edge cases', 'Ambiguous tech spec'],
    },
  ];
}
```
When corrections exceed thresholds (e.g. $\ge 3$ repeated issues for a skill), the loop automatically triggers `/aim` and authoring tools to draft a PR modifying `skills/<name>/SKILL.md` with explicit anti-patterns and negative examples.
