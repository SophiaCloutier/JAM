import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

/*
 * Testing strategy
 *
 * Concept independence (every file in src/concepts/)
 *   partition on each relative import:
 *     - into the same concept (Matching.registry.ts -> Matching.ts): allowed
 *     - outside src/concepts/ (state, config, planner...): allowed
 *     - into another concept: forbidden
 *   partition on import syntax the checker must recognise:
 *     - from '...'
 *     - import('...')
 *     - import '...'
 *
 * Event generation
 *   - EventGenerating and the planner never call or import similarity
 *   - the planner imports no concept
 */

const conceptsDir = resolve(import.meta.dir, '../src/concepts');

/** Concept name of a file in src/concepts: `Matching.ts` and `Matching.registry.ts` both belong to Matching. */
function owner(file: string) {
  return basename(file).split('.')[0];
}

/** Every module specifier in a source file. */
function specifiers(source: string) {
  const pattern = /(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g;
  return [...source.matchAll(pattern)].map(m => m[1]);
}

function read(path: string) {
  return readFileSync(resolve(import.meta.dir, path), 'utf8');
}

describe('concept independence', () => {
  // covers: same-concept imports, imports outside src/concepts/, no cross-concept imports
  test('no concept imports another concept', () => {
    const files = readdirSync(conceptsDir).filter(f => f.endsWith('.ts'));
    expect(files.length).toBeGreaterThan(0);

    const violations: string[] = [];
    for (const file of files) {
      for (const spec of specifiers(readFileSync(join(conceptsDir, file), 'utf8'))) {
        if (!spec.startsWith('.')) continue;
        const target = resolve(conceptsDir, spec);
        if (dirname(target) === conceptsDir && owner(target) !== owner(file)) violations.push(`${file} imports ${spec}`);
      }
    }
    expect(violations).toEqual([]);
  });

  // covers: the checker recognises a cross-concept import
  test('the import check catches a cross-concept import', () => {
    const source = `import { MatchingConcept } from './Matching.ts';\nimport x from '../state.ts';`;
    expect(specifiers(source)).toEqual(['./Matching.ts', '../state.ts']);
  });
});

describe('event generation', () => {
  // covers: no similarity in EventGenerating or the planner; planner imports no concept
  test('event generation uses no similarity, and the planner imports no concept', () => {
    for (const file of ['../src/event-planner.ts', '../src/concepts/EventGenerating.ts']) {
      expect(read(file)).not.toMatch(/\bsimilarity\s*\(|import[^;]*\bsimilarity\b/);
    }
    expect(read('../src/event-planner.ts')).not.toMatch(/from\s+['"][^'"]*concepts/);
  });
});
