import { Context } from '@deepseek-ai/cordis';
import { SoftwareFactoryService } from './service.js';
import { Config } from './config.js';
import { registerLifecycleHooks } from './hooks/index.js';
import { registerCommands } from './commands/index.js';
import type { SoftwareFactoryConfig } from './types.js';

export const name = 'software-factory';
export { Config };
export * from './types.js';
export * from './service.js';
export * from './lib/factory.js';
export * from './lib/agents-md.js';
export * from './lib/report.js';
export * from './hooks/index.js';
export * from './commands/index.js';

/**
 * Main Cordis plugin entrypoint for DeepSeek Harness
 */
export function apply(ctx: Context, config: SoftwareFactoryConfig = {}): void {
  // If explicitly disabled in config, skip registration
  if (config.enabled === false) {
    return;
  }

  // 1. Provide the SoftwareFactoryService to Cordis context
  ctx.plugin(SoftwareFactoryService, config);

  // 2. Register lifecycle hooks and governance guards
  registerLifecycleHooks(ctx, config);

  // 3. Register Software Factory slash commands
  registerCommands(ctx);
}
