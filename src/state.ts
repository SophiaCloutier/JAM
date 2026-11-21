import { database } from './database.ts';

/** One small aggregate per concept makes multi-row alpha decisions atomic on standalone MongoDB.
 * Mutators must be pure: compare-and-swap can retry. This is not shared domain state.
 */
export class AtomicState<T extends object> {
  constructor(private readonly collection: string, private readonly initial: () => T) {}
  async read(): Promise<T> {
    const row = await database().collection<{ _id: string; revision: number; value: T }>(this.collection).findOne({ _id: 'state' });
    return row?.value ?? this.initial();
  }
  async change<R>(mutate: (value: T) => R): Promise<R> {
    const rows = database().collection<{ _id: string; revision: number; value: T }>(this.collection);
    await rows.updateOne({ _id: 'state' }, { $setOnInsert: { revision: 0, value: this.initial() } }, { upsert: true });
    for (let attempt = 0; attempt < 20; attempt++) {
      const row = (await rows.findOne({ _id: 'state' }))!;
      const result = mutate(row.value);
      const written = await rows.updateOne({ _id: 'state', revision: row.revision }, { $set: { value: row.value }, $inc: { revision: 1 } });
      if (written.modifiedCount) return result;
    }
    throw new Error('Concurrent update limit reached. Retry the operation.');
  }
}
