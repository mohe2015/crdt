import { CmRDT, CmRDTFactory, CmRDTLogEntry, CmRDTTransaction } from "./index"
import postgres from 'postgres'

type UnwrapPromiseArray<T> = T extends any[] ? {
    [k in keyof T]: T[k] extends Promise<infer R> ? R : T[k]
} : T;

class PostgresCmRDTFactory implements CmRDTFactory {
    async initialize<T>(databaseName: string): Promise<CmRDT<T>> {
       let sql = postgres({
           database: databaseName,
            ssl: true
       })
       return new PostgresCmRDT<T>(sql);
    }
}

export class PostgresCmRDT<T> extends CmRDT<T> {
    sql: postgres.Sql<{}>;
  
    constructor(sql: postgres.Sql<{}>) {
      super()
      this.sql = sql;
    }

    async transaction<T>(storeNames: Iterable<string>, mode: IDBTransactionMode, cb: (transaction: CmRDTTransaction<T>) => T | Promise<T>): Promise<UnwrapPromiseArray<T>> {
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
        throw new Error()
    }

    async getHeads(): Promise<Set<ArrayBuffer>> {

    }

    async insertEntries(entries: Set<CmRDTLogEntry<T>>): Promise<void> {
        throw new Error()
    }

    async contains(hash: ArrayBuffer): Promise<boolean> {
        // https://github.com/porsager/postgres/issues/85
        let [first]: [{"COUNT": number}] = await this.sql`SELECT COUNT(*) FROM log WHERE hash = ${Buffer.from(new Uint8Array(hash))}}]`
        return first.COUNT === 1
    }
}