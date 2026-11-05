import { describe, it, expect } from 'vitest';
import { planAgentsMd, loadTemplates, digest } from '../src/lib/agents-md.js';

describe('Phase 2: AGENTS.md idempotent synchronization', () => {
  const templates = loadTemplates();

  it('creates full AGENTS.md when file is null or empty', () => {
    const plan = planAgentsMd(null, templates);
    expect(plan.action).toBe('create');
    expect(plan.to).toBe(templates.version);
    expect(plan.text).toContain('<!-- software-factory:begin kind=full');
    expect(plan.text).toContain('<!-- software-factory:end -->');
  });

  it('reports current if text is up to date', () => {
    const planCreate = planAgentsMd(null, templates);
    const planCheck = planAgentsMd(planCreate.text!, templates);
    expect(planCheck.action).toBe('current');
  });

  it('updates factory section when version or templates change', () => {
    const oldTemplates = {
      ...templates,
      version: '3.0.0',
    };
    const oldFile = planAgentsMd(null, oldTemplates).text!;
    const updatePlan = planAgentsMd(oldFile, templates);
    expect(updatePlan.action).toBe('update');
    expect(updatePlan.from).toBe('3.0.0');
    expect(updatePlan.to).toBe(templates.version);
  });

  it('flags edited block if user modified inside markers without replaceEdited', () => {
    const file = planAgentsMd(null, templates).text!;
    const tampered = file.replace('0. **Triage.**', '0. **Custom Step.**');
    const check = planAgentsMd(tampered, templates);
    expect(check.action).toBe('edited');
  });
});
