import { Context } from '@deepseek-ai/cordis';
import type { CommandDefinition, CommandContext } from './types.js';
import { triageCommand } from './triage.js';
import { aimCommand } from './aim.js';
import { specCommand } from './spec.js';
import { factoryLoopCommand } from './factory-loop.js';
import { factoryReportCommand } from './factory-report.js';
import { sidecarCommand } from './sidecar.js';

export * from './types.js';
export {
  triageCommand,
  aimCommand,
  specCommand,
  factoryLoopCommand,
  factoryReportCommand,
  sidecarCommand,
};

export const ALL_COMMANDS: CommandDefinition[] = [
  triageCommand,
  aimCommand,
  specCommand,
  factoryLoopCommand,
  factoryReportCommand,
  sidecarCommand,
];

/**
 * Registers Software Factory slash commands into Cordis / DeepSeek Harness
 */
export function registerCommands(ctx: Context): void {
  // Cordis proxies property access and throws if checking un-injected service names directly on ctx.
  // We use reflect.get or safe inspection if available:
  let hostCommands: any = null;
  try {
    hostCommands = (ctx.reflect as any)?.get?.('commands') || (ctx.reflect as any)?.get?.('command');
  } catch {
    // Reflect fallback
  }

  for (const cmd of ALL_COMMANDS) {
    if (hostCommands && typeof hostCommands.register === 'function') {
      hostCommands.register({
        name: cmd.name,
        description: cmd.description,
        argumentHint: cmd.argumentHint,
        execute: (cmdCtx: CommandContext, ...args: string[]) => cmd.action(cmdCtx, ...args),
      });
    }

    // Also register on Cordis event bus for interaction routing
    ctx.on(`command/${cmd.name}` as any, (cmdCtx: CommandContext, ...args: string[]) => {
      return cmd.action(cmdCtx, ...args);
    });
  }
}
