import { Context } from '@deepseek-ai/cordis';
import { SoftwareFactoryService } from './service.js';
import { Config } from './config.js';
import type { SoftwareFactoryConfig } from './types.js';

export const name = 'software-factory';
export { Config };
export * from './types.js';
export * from './service.js';
export * from './lib/factory.js';

/**
 * Main Cordis plugin entrypoint for DeepSeek Harness
 */
export function apply(ctx: Context, config: SoftwareFactoryConfig = {}): void {
  // If explicitly disabled in config, skip registration
  if (config.enabled === false) {
    return;
  }

  // Provide the SoftwareFactoryService to Cordis context
  ctx.plugin(SoftwareFactoryService, config);
}
