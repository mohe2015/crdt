import { CmRDT, CmRDTFactory, CmRDTLogEntry, CmRDTTransaction } from "./index"

export class IndexedDBCmRDTTransaction<T> extends CmRDTTransaction<T> {
    transaction: IDBTransaction
  
    constructor(transaction: IDBTransaction) {
      super()
      this.transaction = transaction
    }
  
    handleRequest<T>(request: IDBRequest<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        request.addEventListener('error', (event) => {
          event.stopPropagation() // as the name implies this prevents propagation
          reject(request.error)
        })
        request.addEventListener('success', () => {
          resolve(request.result)
        })
      })
    }
  
    // NEW DATABASE DESIGN
    // out of line auto-incrementing integer primary key | value | hash | previous | author | signature
    // always store in topological order - this is hard with backwards insertion but would be benefical
  
    /**
     * @requires transaction be readwrite and accessing log and heads
     * @param entries 
     */
    async insertEntries(entries: Set<CmRDTLogEntry<T>>): Promise<void> {
      const logObjectStore = this.transaction.objectStore("log");
      const headsObjectStore = this.transaction.objectStore("heads")
  
      for (const entry of entries) {
        await this.handleRequest(logObjectStore.add(entry));
        await this.handleRequest(headsObjectStore.add(entry.hash))
        await Promise.all([...entry.previousHashes].map(h => this.handleRequest(headsObjectStore.delete(h))))
      }
    }
  
    /**
     * @requires transaction be readonly and accessing heads
     * @returns 
     */
    async getHeads(): Promise<Set<ArrayBuffer>> {
      const result = await this.handleRequest(this.transaction.objectStore("heads").getAllKeys());
      return new Set(result as ArrayBuffer[])
    }
  
    /**
     * @requires transaction be readonly and accessing log
     * @param entries 
     * @returns 
     */
    async getEntries(entries: Set<ArrayBuffer>): Promise<Set<CmRDTLogEntry<any>>> {
      const logObjectStore = this.transaction.objectStore("log");
      const result = await Promise.all([...entries].map(async hash => await this.handleRequest(logObjectStore.get(hash))))
      return new Set(result)
    }
  
    /**
     * @requires transaction be readonly and accessing log
     * @param hash 
     * @returns 
     */
    async contains(hash: ArrayBuffer): Promise<boolean> {
      return (await this.handleRequest(this.transaction.objectStore("log").getKey(hash))) === undefined
    }
  }
  
  export class IndexedDBCmRDTFactory implements CmRDTFactory {
  
    initialize<T>(databaseName: string) {
      return new Promise<IndexedDBCmRDT<T>>((resolve, reject) => {
        const request = indexedDB.open(databaseName, 2)
        request.addEventListener("upgradeneeded", () => {
          request.result.createObjectStore("log", {
            autoIncrement: false,
            keyPath: "hash"
          });
          request.result.createObjectStore("heads", {
            autoIncrement: false,
            keyPath: ""
          })
        });
        request.addEventListener("error", () => {
          reject(request.error);
        });
        request.addEventListener("success", () => {
          resolve(new IndexedDBCmRDT<T>(request.result));
        })
        request.addEventListener("blocked", () => {
          // TODO FIXME
          reject(new Error("database blocked"));
        })
      });
    }
  }
  
  export class IndexedDBCmRDT<T> extends CmRDT<T> {
    idbDatabase: IDBDatabase;
  
    constructor(idbDatabase: IDBDatabase) {
      super()
      this.idbDatabase = idbDatabase;
    }
  
    async transaction<T>(storeNames: Iterable<string>, mode: IDBTransactionMode, cb: (transaction: CmRDTTransaction<T>) => Promise<T>): Promise<T> {
      let idbTransaction = this.idbDatabase.transaction(storeNames, mode);
      const done = new Promise<void>((resolve, reject) => {
        idbTransaction.addEventListener('abort', () => {
          console.warn(idbTransaction.error)
          resolve() // aborting was likely done explicitly so this SHOULD be fine
        })
        idbTransaction.addEventListener('complete', () => {
          resolve()
        })
        idbTransaction.addEventListener('error', (event) => {
          event.stopPropagation()
          reject(idbTransaction.error)
        })
      })
      let transaction = new IndexedDBCmRDTTransaction<T>(idbTransaction)
      return await cb(transaction)
    }
  }
  