import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export type ModelTier = 'fast' | 'balanced' | 'frontier';

export interface RoutingRule {
  class: string;
  maxLinesChanged?: number;
  tier: ModelTier;
  reason?: string;
}

export interface RoutingConfig {
  default: ModelTier;
  tiers: {
    fast: string;
    balanced: string;
    frontier: string;
  };
  rules: RoutingRule[];
}

export const DEFAULT_ROUTING: RoutingConfig = {
  default: 'balanced',
  tiers: {
    fast: 'deepseek-ai/deepseek-v3',
    balanced: 'deepseek-ai/deepseek-r1',
    frontier: 'deepseek-ai/deepseek-r1',
  },
  rules: [
    { class: 'typo', maxLinesChanged: 10, tier: 'fast', reason: 'Trivial wording change' },
    { class: 'docs', maxLinesChanged: 100, tier: 'fast', reason: 'Documentation updates' },
    { class: 'chore', maxLinesChanged: 50, tier: 'fast', reason: 'Dependency or config updates' },
    { class: 'bugfix', maxLinesChanged: 200, tier: 'balanced', reason: 'Standard localized bug resolution' },
    { class: 'feature', maxLinesChanged: 400, tier: 'balanced', reason: 'Feature implementation' },
    { class: 'refactor', tier: 'frontier', reason: 'Architecture boundary extraction or migration' },
    { class: 'loop', tier: 'balanced', reason: 'Outer feedback loop analysis' },
  ],
};

export interface ResolvedTier {
  tier: ModelTier;
  modelId: string;
  ruleMatched?: RoutingRule;
}

/**
 * Resolves optimal model tier based on task classification and lines changed
 */
export function resolveModelTier(
  taskClass: string,
  linesCount: number = 0,
  factoryDir?: string
): ResolvedTier {
  let config = DEFAULT_ROUTING;

  if (factoryDir) {
    const configFile = join(factoryDir, 'routing.json');
    if (existsSync(configFile)) {
      try {
        config = JSON.parse(readFileSync(configFile, 'utf8'));
      } catch {
        // Fallback
      }
    }
  }

  for (const rule of config.rules) {
    if (rule.class.toLowerCase() === taskClass.toLowerCase()) {
      if (rule.maxLinesChanged && linesCount > rule.maxLinesChanged) {
        continue;
      }
      return {
        tier: rule.tier,
        modelId: config.tiers[rule.tier] || config.tiers[config.default],
        ruleMatched: rule,
      };
    }
  }

  return {
    tier: config.default,
    modelId: config.tiers[config.default],
  };
}
