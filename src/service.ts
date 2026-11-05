import { Context, Service } from '@deepseek-ai/cordis';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { SoftwareFactoryConfig } from './types.js';
import { findRepoRoot } from './lib/factory.js';

export class SoftwareFactoryService extends Service {
  public rootDir: string;
  public factoryDir: string;
  public isFactoryRepo: boolean;
  public config: SoftwareFactoryConfig;

  constructor(ctx: Context, config: SoftwareFactoryConfig = {}) {
    // Register as 'softwareFactory' in Cordis
    super(ctx, 'softwareFactory');
    this.config = config;

    this.rootDir = findRepoRoot(process.cwd());
    this.factoryDir = join(this.rootDir, '.factory');
    this.isFactoryRepo = existsSync(this.factoryDir);
  }

  /**
   * Refresh repository boundaries if workspace or working directory changes
   */
  public refreshWorkspace(targetDir: string = process.cwd()): void {
    this.rootDir = findRepoRoot(targetDir);
    this.factoryDir = join(this.rootDir, '.factory');
    this.isFactoryRepo = existsSync(this.factoryDir);
  }
}
