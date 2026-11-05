import { describe, it, expect, vi } from 'vitest';
import { Context } from '@deepseek-ai/cordis';
import { registerWebPanels } from '../src/ui/panels.js';

describe('Phase 6: Web UI Integration', () => {
  it('registers factory-status and factory-memory panels with DSH Web UI', () => {
    const registerPanel = vi.fn();
    const ctx = new Context();
    (ctx as any).web = { registerPanel };

    registerWebPanels(ctx);

    expect(registerPanel).toHaveBeenCalledTimes(2);
    expect(registerPanel).toHaveBeenCalledWith(
      'factory-status',
      expect.objectContaining({
        title: 'Software Factory',
        icon: 'wrench-screwdriver',
      })
    );
    expect(registerPanel).toHaveBeenCalledWith(
      'factory-memory',
      expect.objectContaining({
        title: 'Factory Memory',
        icon: 'book-open',
      })
    );
  });

  it('fails open gracefully when Web UI service is unavailable (headless CLI mode)', () => {
    const ctx = new Context();
    expect(() => registerWebPanels(ctx)).not.toThrow();
  });
});
