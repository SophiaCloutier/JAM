import { expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

const dir = resolve(import.meta.dir, '../src/concepts');
/** Concept name of a file in src/concepts: `Matching.ts` and `Matching.registry.ts` both belong to Matching. */
const owner = (file: string) => basename(file).split('.')[0];
const specifiers = (source: string) => [...source.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g)].map(m => m[1]);

test('no concept imports another concept', () => {
  const files = readdirSync(dir).filter(f => f.endsWith('.ts'));
  expect(files.length).toBeGreaterThan(0);
  const violations: string[] = [];
  for (const file of files) for (const spec of specifiers(readFileSync(join(dir, file), 'utf8'))) {
    if (!spec.startsWith('.')) continue;
    const target = resolve(dir, spec);
    if (dirname(target) === dir && owner(target) !== owner(file)) violations.push(`${file} imports ${spec}`);
  }
  expect(violations).toEqual([]);
});

test('the import check catches a cross-concept import', () => {
  expect(specifiers(`import { MatchingConcept } from './Matching.ts';\nimport x from '../state.ts';`)).toEqual(['./Matching.ts', '../state.ts']);
});

test('event generation uses no similarity, and the planner imports no concept', () => {
  for (const file of ['../src/event-planner.ts', '../src/concepts/EventGenerating.ts']) {
    const source = readFileSync(resolve(import.meta.dir, file), 'utf8');
    expect(source).not.toMatch(/\bsimilarity\s*\(|import[^;]*\bsimilarity\b/);
  }
  expect(readFileSync(resolve(import.meta.dir, '../src/event-planner.ts'), 'utf8')).not.toMatch(/from\s+['"][^'"]*concepts/);
});
