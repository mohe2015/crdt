import { CmRDT, CmRDTFactory, CmRDTLogEntry, CmRDTTransaction, UnwrapPromiseArray } from "./index"
import postgres from 'postgres'

class PostgresCmRDTFactory implements CmRDTFactory {
    async initialize<T>(databaseName: string): Promise<CmRDT<T>> {
       let sql = postgres({
           database: databaseName,
            ssl: true
       })
       let cmrdt = new PostgresCmRDT<T>(sql);
       await cmrdt.transaction([], "readwrite", async (sql: PostgresCmRDTTransaction<any>) => {
            await sql.sql`CREATE TABLE IF NOT EXISTS log (
                hash bytea PRIMARY KEY NOT NULL,
                random bytea NOT NULL,
                author bytea NOT NULL,
                signature bytea NOT NULL,
                value bytea NOT NULL, 
            )`
            await sql.sql`CREATE TABLE IF NOT EXISTS log_previous_hashes (
                hash bytea NOT NULL references log(hash),
                previous_hash bytea NOT NULL references log(hash),
            )`
            await sql.sql`CREATE TABLE IF NOT EXISTS heads (
                hash bytea NOT NULL references log(hash),
            )`
       })
       return cmrdt
    }
}

export class PostgresCmRDT<T> extends CmRDT<T> {
    sql: postgres.Sql<{}>;
  
    constructor(sql: postgres.Sql<{}>) {
      super()
      this.sql = sql;
    }

    async transaction<T>(storeNames: Iterable<string>, mode: IDBTransactionMode, cb: (transaction: PostgresCmRDTTransaction<T>) => Promise<T>): Promise<UnwrapPromiseArray<T>> {
        return await this.sql.begin(async sql => {
            return await cb(new PostgresCmRDTTransaction(sql))
        })
    }
}

export class PostgresCmRDTTransaction<T> extends CmRDTTransaction<T> {
    sql: postgres.TransactionSql<{}>

    constructor(sql: postgres.TransactionSql<{}>) {
        super()
        this.sql = sql
    }

    async getEntries(hashes: Set<ArrayBuffer>): Promise<Set<CmRDTLogEntry<any>>> {
        // TODO FIXME previous_hashes
        return new Set(await this.sql<CmRDTLogEntry<any>[]>`SELECT hash, random, author, signature, value FROM log WHERE hash in (${[...hashes].map(h => Buffer.from(new Uint8Array(h)))})`)
    }

    async getHeads(): Promise<Set<ArrayBuffer>> {
        return new Set(await this.sql<ArrayBuffer[]>`SELECT hash FROM heads`)
    }

    async insertEntries(entries: Set<CmRDTLogEntry<T>>): Promise<void> {
        // TODO FIXME update previous_hashes
        // TODO FIXME update heads
        let test = [...entries] as any[] // TODO FIXME
        await this.sql`INSERT INTO log ${this.sql(test, 'test')}`
    }

    async contains(hash: ArrayBuffer): Promise<boolean> {
        // https://github.com/porsager/postgres/issues/85
        let [first]: [{"COUNT": number}] = await this.sql`SELECT COUNT(*) FROM log WHERE hash = ${Buffer.from(new Uint8Array(hash))}}]`
        return first.COUNT === 1
    }
}