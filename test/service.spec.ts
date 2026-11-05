import { describe, it, expect } from 'vitest';
import { Context } from '@deepseek-ai/cordis';
import { apply } from '../src/index.js';
import { SoftwareFactoryService } from '../src/service.js';

describe('Phase 1: Software Factory Cordis Plugin Scaffolding', () => {
  it('instantiates and provides SoftwareFactoryService in Cordis context', async () => {
    const ctx = new Context();
    
    // Load plugin
    const fiber = await ctx.plugin(apply, {
      enabled: true,
      autoSyncAgentsMd: 'off',
      defaultRoutingTier: 'balanced',
    });

    expect(fiber).toBeDefined();

    // Verify service presence and typed injection
    expect(ctx.softwareFactory).toBeDefined();
    expect(ctx.softwareFactory).toBeInstanceOf(SoftwareFactoryService);
    expect(ctx.softwareFactory.config.defaultRoutingTier).toBe('balanced');
    expect(ctx.softwareFactory.rootDir).toBeDefined();
    expect(ctx.softwareFactory.factoryDir).toBeDefined();

    // Cleanup fiber via .dispose()
    await fiber.dispose();
  });

  it('respects enabled: false and does not register service', async () => {
    const ctx = new Context();
    
    const fiber = await ctx.plugin(apply, {
      enabled: false,
    });

    expect(ctx.softwareFactory).toBeUndefined();
    await fiber.dispose();
  });
});
