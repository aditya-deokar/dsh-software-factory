import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export interface MemoryEntry {
  id: string;
  fact: string;
  source: string;
  timesUsed: number;
  lastUsed: string;
  tags?: string[];
}

export class MemoryEngine {
  constructor(public memoryDir: string) {
    if (!existsSync(memoryDir)) {
      mkdirSync(memoryDir, { recursive: true });
    }
  }

  public recordFact(id: string, fact: string, source: string, tags: string[] = []): MemoryEntry {
    const file = join(this.memoryDir, `${id}.json`);
    const entry: MemoryEntry = {
      id,
      fact,
      source,
      timesUsed: 1,
      lastUsed: new Date().toISOString(),
      tags,
    };
    writeFileSync(file, JSON.stringify(entry, null, 2));
    this.rebuildIndex();
    return entry;
  }

  public recordUse(id: string): MemoryEntry | null {
    const file = join(this.memoryDir, `${id}.json`);
    if (!existsSync(file)) return null;
    const entry: MemoryEntry = JSON.parse(readFileSync(file, 'utf8'));
    entry.timesUsed += 1;
    entry.lastUsed = new Date().toISOString();
    writeFileSync(file, JSON.stringify(entry, null, 2));

    // Graduation check: fact used 3 or more times graduates as candidate for permanent skill rule
    if (entry.timesUsed >= 3) {
      this.flagForGraduation(entry);
    }
    this.rebuildIndex();
    return entry;
  }

  public searchFacts(query: string): MemoryEntry[] {
    const entries = this.listEntries();
    const q = query.toLowerCase();
    return entries.filter(
      (e) =>
        e.id.toLowerCase().includes(q) ||
        e.fact.toLowerCase().includes(q) ||
        e.tags?.some((t) => t.toLowerCase().includes(q))
    );
  }

  public listEntries(): MemoryEntry[] {
    if (!existsSync(this.memoryDir)) return [];
    return readdirSync(this.memoryDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        try {
          return JSON.parse(readFileSync(join(this.memoryDir, f), 'utf8')) as MemoryEntry;
        } catch {
          return null;
        }
      })
      .filter((e): e is MemoryEntry => e !== null)
      .sort((a, b) => b.timesUsed - a.timesUsed);
  }

  private flagForGraduation(entry: MemoryEntry): void {
    const gradFile = join(this.memoryDir, 'GRADUATE.md');
    const note = `- [ ] Memory \`${entry.id}\` used ${entry.timesUsed} times: "${entry.fact}" (source: ${entry.source})\n`;
    if (!existsSync(gradFile)) {
      writeFileSync(
        gradFile,
        '# Software Factory Memory Graduation Candidates\nFacts used 3+ times ready to graduate into permanent skills:\n\n'
      );
    }
    const current = readFileSync(gradFile, 'utf8');
    if (!current.includes(`\`${entry.id}\``)) {
      writeFileSync(gradFile, note, { flag: 'a' });
    }
  }

  public rebuildIndex(): string {
    const entries = this.listEntries();
    const lines = [
      '# Software Factory Memory Index',
      'Verified repository facts, architectural decisions, and environment invariants. Rebuilt automatically.',
      '',
    ];

    if (entries.length === 0) {
      lines.push('_No memories recorded yet._');
    } else {
      for (const e of entries) {
        lines.push(`- **${e.id}**: ${e.fact} (seen ${e.timesUsed}x, source: ${e.source})`);
      }
    }

    const indexContent = lines.join('\n');
    writeFileSync(join(this.memoryDir, 'INDEX.md'), indexContent);
    return indexContent;
  }
}
