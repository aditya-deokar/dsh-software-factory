import { Context } from '@deepseek-ai/cordis';

export interface WebPanelDefinition {
  title: string;
  icon: string;
  component: () => {
    template: string;
    script?: string;
    style?: string;
  };
}

export interface WebService {
  registerPanel: (id: string, definition: WebPanelDefinition) => void;
  registerSidebarItem?: (item: any) => void;
}

/**
 * Registers DeepSeek Harness Web UI interactive panels:
 * 1. Factory Status Panel (active beat, aim judge, worktree, tier)
 * 2. Run Ledger Explorer
 * 3. Memory & Invariants Graph
 */
export function registerWebPanels(ctx: Context): void {
  let webService: WebService | null = null;
  try {
    webService = (ctx.reflect as any)?.get?.('web') || (ctx as any).web;
  } catch {
    // Graceful fallback for CLI/headless mode
  }

  if (!webService || typeof webService.registerPanel !== 'function') {
    return;
  }

  // 1. Factory Status Panel
  webService.registerPanel('factory-status', {
    title: 'Software Factory',
    icon: 'wrench-screwdriver',
    component: () => ({
      template: `
        <div class="factory-dashboard p-4 space-y-4">
          <div class="flex items-center justify-between border-b pb-2">
            <h3 class="font-bold text-lg">Software Factory Loop</h3>
            <span class="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800 font-mono">Active</span>
          </div>

          <div class="grid grid-cols-2 gap-3 text-sm">
            <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">
              <span class="text-gray-500 text-xs block">Active Worktree</span>
              <span class="font-mono font-medium">{{ worktree || 'main workspace' }}</span>
            </div>
            <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">
              <span class="text-gray-500 text-xs block">Model Tier</span>
              <span class="font-mono font-medium text-emerald-600">{{ modelTier || 'balanced' }}</span>
            </div>
          </div>

          <div class="border rounded p-3 bg-white dark:bg-gray-900">
            <span class="text-gray-500 text-xs block mb-1">Aim Outside Judge</span>
            <div class="font-mono text-sm text-gray-800 dark:text-gray-200">
              {{ aimJudge || 'No active judge set - run /aim' }}
            </div>
          </div>

          <div class="flex gap-2 pt-2">
            <button class="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700" onclick="dsh.runCommand('/factory-report')">Report</button>
            <button class="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300" onclick="dsh.runCommand('/factory-loop')">Run Loop</button>
          </div>
        </div>
      `,
    }),
  });

  // 2. Memory Explorer Panel
  webService.registerPanel('factory-memory', {
    title: 'Factory Memory',
    icon: 'book-open',
    component: () => ({
      template: `
        <div class="factory-memory-panel p-4 space-y-3">
          <div class="flex items-center justify-between border-b pb-2">
            <h4 class="font-semibold text-sm">Project Invariants & Facts</h4>
            <span class="text-xs text-gray-500">INDEX.md</span>
          </div>
          <div class="memory-list space-y-2 text-xs font-mono">
            {{ memoryEntries }}
          </div>
        </div>
      `,
    }),
  });
}
