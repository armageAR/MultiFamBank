import Dexie, { type EntityTable } from 'dexie'

/** Last server data downloaded for a bank, shown while offline. */
export interface Snapshot {
  key: string
  data: unknown
  syncedAt: string
}

/** A request prepared locally and not yet accepted by the API. */
export interface OutboxRequest {
  id: string // client-generated UUID, used as the idempotency key
  payload: unknown
  createdAt: string
  lastError?: string
}

export type BankDatabase = Dexie & {
  snapshots: EntityTable<Snapshot, 'key'>
  outbox: EntityTable<OutboxRequest, 'id'>
}

/**
 * Opens the local database for one user in one bank. Data is partitioned
 * per user and bank so a different session never reads another's cache.
 */
export function openBankDatabase(userId: string | number, bankId: string | number): BankDatabase {
  const db = new Dexie(`multifambank:${userId}:${bankId}`) as BankDatabase
  db.version(1).stores({
    snapshots: 'key',
    outbox: 'id, createdAt',
  })
  return db
}

/** Deletes every local database owned by a user, e.g. on sign-out. */
export async function clearUserData(userId: string | number): Promise<void> {
  const names = await Dexie.getDatabaseNames()
  await Promise.all(
    names.filter((name) => name.startsWith(`multifambank:${userId}:`)).map((name) => Dexie.delete(name)),
  )
}
