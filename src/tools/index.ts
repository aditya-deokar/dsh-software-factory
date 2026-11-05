import { Context } from '@deepseek-ai/cordis';
import type { ToolDefinition } from './types.js';
import { worktreeTool } from './worktree.js';
import { evidenceTool } from './evidence.js';
import { reviewTool } from './review.js';
import { ledgerTool } from './ledger.js';

export * from './types.js';
export { worktreeTool, evidenceTool, reviewTool, ledgerTool };

export const ALL_TOOLS: ToolDefinition[] = [
  worktreeTool,
  evidenceTool,
  reviewTool,
  ledgerTool,
];

/**
 * Registers native Software Factory tools for function calling and Programmatic Tool Calling (PTC)
 */
export function registerTools(ctx: Context): void {
  let hostTools: any = null;
  try {
    hostTools = (ctx.reflect as any)?.get?.('tools') || (ctx.reflect as any)?.get?.('tool');
  } catch {
    // Reflect fallback
  }

  for (const tool of ALL_TOOLS) {
    if (hostTools && typeof hostTools.register === 'function') {
      hostTools.register(tool.name, {
        description: tool.description,
        parameters: tool.parameters,
        execute: (args: any, env: any) => tool.execute(args, env),
      });
    }

    // Register on Cordis event bus for programmatic tool dispatch (PTC Mode)
    ctx.on(`tool/${tool.name}` as any, (args: any, env: any) => {
      return tool.execute(args, env);
    });
  }
}
