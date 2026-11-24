import { MongoClient } from 'mongodb';
let client: MongoClient | undefined;
export function database() {
  client ??= new MongoClient(process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/jam_alpha', {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 5000,
  });
  return client.db(process.env.MONGODB_DATABASE || undefined);
}
export async function closeDatabase() {
  await client?.close();
  client = undefined;
}
