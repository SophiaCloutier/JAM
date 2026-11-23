import { expect, test } from 'bun:test';
import { didYouMean } from '../shared/catalog.ts';

test('didYouMean catches near-misses of suggested tags only', () => {
  expect(didYouMean('potery')).toBe('pottery');        // missing letter
  expect(didYouMean('drawnig')).toBe('drawing');       // swapped letters
  expect(didYouMean('Paintng ')).toBe('painting');     // case, space, missing letter
  expect(didYouMean('pottery')).toBeUndefined();       // exact: nothing to suggest
  expect(didYouMean('ceramics')).toBeUndefined();      // alias resolves to pottery exactly
  expect(didYouMean('dance')).toBeUndefined();         // a real different interest
  expect(didYouMean('drum')).toBe('drums');
  expect(didYouMean('rum')).toBeUndefined();           // short words get only one typo
});
