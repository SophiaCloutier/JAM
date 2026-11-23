import type { EndpointValidator } from '@mit-sdg/sync-engine/boundary';
export function input(keys: string[], check: (v: Record<string, unknown>) => boolean = () => true): EndpointValidator {
  return value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, detail: 'Send a JSON object.' };
    const v = value as Record<string, unknown>;
    return Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k)) &&
      (!keys.includes('session') || v.session === null || typeof v.session === 'string') && check(v)
      ? { ok: true } : { ok: false, detail: 'Check the submitted fields and try again.' };
  };
}
export const text = (v: unknown, max = 254): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;
export const sessionInput = input(['session']);
