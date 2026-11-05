import Schema from '@deepseek-ai/schemastery';
import type { SoftwareFactoryConfig } from './types.js';

export const Config: Schema<SoftwareFactoryConfig> = Schema.object({
  enabled: Schema.boolean()
    .default(true)
    .description('Enable or disable Software Factory features in this profile.'),
  autoSyncAgentsMd: Schema.union([
    Schema.const('auto').description('Automatically update outdated factory section'),
    Schema.const('notify').description('Notify about updates without overwriting'),
    Schema.const('off').description('Disable AGENTS.md checks'),
  ])
    .default('auto')
    .description('How to synchronize the factory section in AGENTS.md.'),
  defaultRoutingTier: Schema.union([
    Schema.const('fast').description('Fast and low-cost model tier (e.g. DeepSeek-V3)'),
    Schema.const('balanced').description('Balanced reasoning and code generation tier (e.g. DeepSeek-R1)'),
    Schema.const('frontier').description('High-capacity reasoning frontier tier'),
  ])
    .default('balanced')
    .description('Default model tier if not specified by task classification.'),
  enforceWorktreeIsolation: Schema.boolean()
    .default(true)
    .description('Ensure tasks work inside dedicated git worktrees.'),
  guardGitPush: Schema.boolean()
    .default(true)
    .description('Block unleased force-pushes and direct pushes to main/master branches.'),
  memoryBudgetTokens: Schema.number()
    .default(4096)
    .description('Token budget allocated for memory index injection during session start.'),
});
