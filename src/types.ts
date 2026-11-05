import { Context } from '@deepseek-ai/cordis';
import type { SoftwareFactoryService } from './service.js';

export interface SoftwareFactoryConfig {
  enabled?: boolean;
  autoSyncAgentsMd?: 'auto' | 'notify' | 'off';
  defaultRoutingTier?: 'fast' | 'balanced' | 'frontier';
  enforceWorktreeIsolation?: boolean;
  guardGitPush?: boolean;
  memoryBudgetTokens?: number;
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    softwareFactory: SoftwareFactoryService;
  }

  interface Events {
    'factory/run-started'(runId: string, branch: string): void;
    'factory/run-finished'(runId: string, summary: Record<string, unknown>): void;
    'factory/memory-graduated'(factId: string, skillTarget: string): void;
  }
}
