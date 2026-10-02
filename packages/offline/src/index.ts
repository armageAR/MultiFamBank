import Dexie, { type EntityTable } from 'dexie'

/** Last server data downloaded for a bank, shown while offline. */
export interface Snapshot {
  key: string
  data: unknown
  syncedAt: string
}

export interface OutboxPayload {
  type: 'savings_deposit' | 'savings_withdrawal' | 'expense'
  amount_ars: string
  description: string | null
}

/**
 * A request prepared on this device and not yet accepted by the API. "queued" waits for a
 * connection; "rejected" means the server refused it and the person has to see why.
 */
export interface OutboxRequest {
  id: string // client-generated UUID, also the idempotency key on the server
  payload: OutboxPayload
  createdAt: string
  state: 'queued' | 'rejected'
  lastError?: string
}

export type BankDatabase = Dexie & {
  snapshots: EntityTable<Snapshot, 'key'>
  outbox: EntityTable<OutboxRequest, 'id'>
}

const PREFIX = 'multifambank:'
const open = new Map<string, BankDatabase>()

/**
 * Opens the local database for one user in one bank. Data is partitioned per user and bank so a
 * different session never reads another's cache or sends another's requests.
 */
export function openBankDatabase(userId: string | number, bankId: string | number): BankDatabase {
  const name = `${PREFIX}${userId}:${bankId}`
  const existing = open.get(name)
  if (existing) return existing

  const db = new Dexie(name) as BankDatabase
  db.version(1).stores({ snapshots: 'key', outbox: 'id, createdAt' })
  db.version(2).stores({ snapshots: 'key', outbox: 'id, createdAt, state' })
  // Deleted or closed elsewhere (sign-out, another tab): the next call opens a fresh instance.
  db.on('close', () => open.delete(name))
  db.on('versionchange', () => {
    open.delete(name)
  })
  open.set(name, db)
  return db
}

export async function enqueue(db: BankDatabase, id: string, payload: OutboxPayload): Promise<void> {
  await db.outbox.put({ id, payload, createdAt: new Date().toISOString(), state: 'queued' })
}

/** Deletes every local database of every user, e.g. when a session ends on this device. */
export async function clearAllOfflineData(): Promise<void> {
  for (const db of open.values()) db.close()
  open.clear()
  const names = await Dexie.getDatabaseNames()
  await Promise.all(names.filter((name) => name.startsWith(PREFIX)).map((name) => Dexie.delete(name)))
}
