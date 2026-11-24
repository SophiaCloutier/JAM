import { assembleApplication } from './src/assembly.ts';
import { httpWire } from '@mit-sdg/sync-engine-http/tooling';
import { policy } from './src/edge.ts';
export default {
  assemble: assembleApplication,
  title: 'JAM alpha',
  wireName: 'JamWire',
  design: {
    version: 1,
    documents: [
      new URL('./design/types.md', import.meta.url),
      new URL('./design/compositions/Application.md', import.meta.url),
    ],
  },
  projections: [httpWire({ policy, name: 'JamWireHttp' })],
};
