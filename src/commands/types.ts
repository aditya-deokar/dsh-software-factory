export interface CommandContext {
  session?: {
    workspaceRoot?: string;
    sendPrompt?: (message: { role: string; content: string }) => Promise<void> | void;
    spawnSubagent?: (options: {
      role: string;
      tier?: string;
      readOnly?: boolean;
      systemPrompt: string;
    }) => Promise<{
      execute: (prompt: string) => Promise<{ content: string }>;
    }>;
  };
  options?: Record<string, any>;
}

export interface CommandDefinition {
  name: string;
  description: string;
  argumentHint?: string;
  action: (ctx: CommandContext, ...args: string[]) => Promise<string> | string;
}
