import Schema from '@deepseek-ai/schemastery';

export interface ToolDefinition<P = any, R = any> {
  name: string;
  description: string;
  parameters: Schema<P>;
  execute: (args: P, env?: { cwd?: string }) => Promise<R> | R;
}

export interface ToolsService {
  register: (name: string, definition: Omit<ToolDefinition, 'name'>) => void;
  get?: (name: string) => ToolDefinition | undefined;
  list?: () => ToolDefinition[];
}
