# 07 - Phase 6: Web UI, Testing, Packaging, and Distribution

## 1. Goal & Objectives
DeepSeek Harness provides both an interactive terminal interface (TUI) and an extensible Web UI. This phase covers:
1. **DSH Web UI Custom Panels**: Visualizing the Factory Inner Loop status, active worktree switcher, run ledger graphs, and memory viewer.
2. **Comprehensive Test Suite**: Unit tests (Vitest), Cordis lifecycle integration tests, and push-guard safety tests.
3. **Packaging & Marketplace Distribution**: Publishing to npm under `@software-factory/dsh-plugin`, configuring metadata for `dsh-plugin` marketplace indexing, and enabling **Creator Mode** compatibility.

---

## 2. Web UI Panel Extensions (`src/ui/panels.ts`)

DeepSeek Harness permits plugins to mount custom Web UI widgets into the sidebar and trajectory viewer.

```typescript
import { Context } from '@deepseek-ai/cordis';

export function registerWebPanels(ctx: Context) {
  // If running in a headless or pure CLI profile, UI extensions fail gracefully
  if (!ctx.web) return;

  ctx.web.registerPanel('factory-status', {
    title: 'Software Factory',
    icon: 'wrench-screwdriver',
    component: () => ({
      template: `
        <div class="factory-panel">
          <div class="beat-indicator">
            <span class="badge" :class="activeBeat">{{ activeBeat || 'Idle' }}</span>
          </div>
          <div class="metrics">
            <p>Worktree: <code>{{ currentWorktree }}</code></p>
            <p>Model Tier: <code>{{ currentTier }}</code></p>
            <p>Aim Judge: <code>{{ aimJudge || 'Not set' }}</code></p>
          </div>
          <div class="actions">
            <button @click="runReport">View Factory Report</button>
            <button @click="runLoop">Run Skill Loop</button>
          </div>
        </div>
      `,
    }),
  });
}
```

---

## 3. Testing Strategy & Test Suites

The test suite ensures zero regressions, particularly around git safety and workspace isolation:

### 3.1 Unit Testing Git Push Guard (`test/guard-push.spec.ts`)

```typescript
import { describe, it, expect } from 'vitest';
import { checkPush } from '../src/hooks/guard-push.js';

describe('PreToolUse Git Push Guard', () => {
  it('blocks bare git push when on main', () => {
    const violation = checkPush('git push', { branchOf: () => 'main' });
    expect(violation).toMatch(/protected branch "main"/);
  });

  it('blocks push targeting origin master', () => {
    const violation = checkPush('git push origin master', { branchOf: () => 'feature/foo' });
    expect(violation).toMatch(/Direct push to protected branch "master" is blocked/);
  });

  it('blocks plain --force', () => {
    const violation = checkPush('git push origin feature/test --force', { branchOf: () => 'feature/test' });
    expect(violation).toMatch(/Plain --force is strictly forbidden/);
  });

  it('allows --force-with-lease on feature branches', () => {
    const violation = checkPush('git push origin feature/test --force-with-lease', { branchOf: () => 'feature/test' });
    expect(violation).toBeNull();
  });

  it('allows normal commit and status commands', () => {
    expect(checkPush('git commit -m "push to main is cool"')).toBeNull();
    expect(checkPush('echo git push origin main')).toBeNull();
  });
});
```

### 3.2 Cordis Service Lifecycle Tests (`test/service.spec.ts`)

```typescript
import { describe, it, expect } from 'vitest';
import { Context } from '@deepseek-ai/cordis';
import { apply } from '../src/index.js';

describe('Software Factory Cordis Plugin Mounting', () => {
  it('mounts service and registers tools cleanly', async () => {
    const ctx = new Context();
    ctx.plugin(apply, { enabled: true, autoSyncAgentsMd: 'off' });

    await ctx.start();
    expect(ctx.softwareFactory).toBeDefined();
    expect(ctx.softwareFactory.config.enabled).toBe(true);

    await ctx.stop();
  });
});
```

---

## 4. Distribution, Creator Mode, and Marketplace Publishing

### 4.1 Marketplace Metadata (`package.json`)
The DeepSeek Harness Plugin Hub (`dsh-plugin.org`) and GitHub crawlers discover plugins via specific tags and package naming conventions:
- **Package Name**: `dsh-software-factory` or `@software-factory/dsh-plugin`
- **Keywords**: `deepseek`, `deepseek-harness`, `dsh-plugin`, `cordis`, `software-factory`
- **GitHub Topics**: `dsh-plugin`, `deepseek-harness`, `cordis`

### 4.2 Creator Mode Prompting Compatibility
To enable DeepSeek Harness users to generate or customize the plugin using DSH's built-in **Creator Mode**, the repository includes a standardized `CREATOR.md` / `ARCHITECTURE.md` specification that guides DeepSeek-V3/R1:

```markdown
# Software Factory Plugin for Creator Mode
When modifying or extending this plugin inside DeepSeek Harness Creator Mode:
1. Always preserve the 8 beats of the inner loop in AGENTS.md.
2. Ensure any new tool is exposed through Cordis Schema.
3. Maintain non-negotiable push guard constraints on default branches.
```

### 4.3 User Installation Commands

Users can install the finished plugin through three different channels:

1. **Via DSH CLI**:
   ```bash
   dsh plugin add dsh-software-factory
   ```
2. **Via DSH Profile Manager**:
   ```bash
   dsh plugin --profile coding add dsh-software-factory
   ```
3. **Via `cordis.yml` Direct Mounting**:
   ```yaml
   plugins:
     - name: dsh-software-factory
       config:
         autoSyncAgentsMd: auto
         guardGitPush: true
         defaultRoutingTier: balanced
   ```
