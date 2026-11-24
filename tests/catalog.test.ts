import { describe, expect, test } from 'bun:test';
import { didYouMean } from '../shared/catalog.ts';

/*
 * Testing strategy
 *
 * didYouMean(tag)
 *   partition on the input:
 *     - a near-miss of a suggested tag:
 *       - missing letter
 *       - swapped letters
 *       - case or spacing plus a typo
 *     - exactly a suggested tag
 *     - an alias that resolves to a suggested tag
 *     - an unrelated real interest
 *   partition on word length:
 *     - short word (under 6 letters): one typo allowed
 *     - longer word: up to two typos allowed
 */

describe('didYouMean: near-misses of suggested tags', () => {
  // covers: missing letter, swapped letters, case/spacing plus a typo; longer words
  test('suggests the tag a typo probably meant', () => {
    expect(didYouMean('potery')).toBe('pottery'); // missing letter
    expect(didYouMean('drawnig')).toBe('drawing'); // swapped letters
    expect(didYouMean('Paintng ')).toBe('painting'); // case, space, missing letter
  });

  // covers: short word, one typo
  test('a short word gets one typo', () => {
    expect(didYouMean('drum')).toBe('drums');
  });
});

describe('didYouMean: nothing to suggest', () => {
  // covers: exact suggested tag, alias
  test('exact tags and aliases need no suggestion', () => {
    expect(didYouMean('pottery')).toBeUndefined(); // exact: nothing to suggest
    expect(didYouMean('ceramics')).toBeUndefined(); // alias resolves to pottery exactly
  });

  // covers: unrelated real interest; short word with two typos
  test('different interests are left alone', () => {
    expect(didYouMean('dance')).toBeUndefined(); // a real different interest
    expect(didYouMean('rum')).toBeUndefined(); // short words get only one typo
  });
});
