/*
 * crdt - Conflict-free Replicated Data Types in Typescript
 *
 * Copyright (C) 2020 Moritz Hedtke <Moritz.Hedtke@t-online.de>
 *
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License along
 * with this program. If not, see <https://www.gnu.org/licenses/>.
 *
 *
 * SPDX-FileCopyrightText: 2020 Moritz Hedtke <Moritz.Hedtke@t-online.de>
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

// https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API

import stringify from 'fast-json-stable-stringify';
import {
  exportPublicKey,
  generateKey,
  hashArrayBuffer,
  sign,
} from '@dev.mohe/crdt-lib';
import crypto from '@dev.mohe/isomorphic-webcrypto';
import type { JSONRPCHandler, JSONRPCRequest, JSONRPCResponse } from './json-rpc';
import type { Remote } from './remote';

// TODO use https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist

export abstract class CmRDTInterface<T> {
  abstract sendHashes(heads: Array<ArrayBuffer>): Promise<void>

  abstract headHashes(): Promise<Set<ArrayBuffer>>

  abstract sendEntries(entries: Array<CmRDTLogEntry<any>>): Promise<void>

  /**
   * This also validates that the remote sent a valid object.
   * @param keys the key to request from the remote
   */
  // https://developer.mozilla.org/en-US/docs/Web/API/Streams_API#concepts_and_usage
  // https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Concepts
  // https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams
  abstract requestEntries(hashes: Array<ArrayBuffer>): Promise<Array<CmRDTLogEntry<T>>>; // TODO FIXME maybe streaming

  abstract requestHashesOfMissingEntries(): Promise<Set<ArrayBuffer>>
}

class CmRDTImplementation<T> extends CmRDTInterface<T> {
  

}

export abstract class CmRDTTransaction<T> {

  abstract getEntries(hashes: Set<ArrayBuffer>): Promise<Set<CmRDTLogEntry<any>>>;

  abstract getHeads(): Promise<Set<ArrayBuffer>>;

  abstract insertEntries(entries: Set<CmRDTLogEntry<T>>): Promise<void>;

  abstract contains(hash: ArrayBuffer): Promise<boolean>
}

export async function hashObject<T>(object: T): Promise<ArrayBuffer> {
  const stringified = stringify(object);
  const enc = new TextEncoder();
  return await crypto.subtle.digest('SHA-512', enc.encode(stringified));
}

export type CmRDTLogEntry<T> = Readonly<{
  value: T;
  hash: ArrayBuffer;
  random: ArrayBuffer;
  previousHashes: ArrayBuffer[];
  author: ArrayBuffer;
  signature: ArrayBuffer;
}>;

function cmrdtLogEntrySize<T>(entry: CmRDTLogEntry<T>): number {
  return stringify(entry.value).length + entry.hash.byteLength + entry.random.byteLength + entry.previousHashes.map(a => a.byteLength).reduce((prev, curr) => prev + curr) + entry.author.byteLength + entry.signature.byteLength
}

export type CmRDTLog<T> = Readonly<CmRDTLogEntry<T>[]>;

export interface CmRDTFactory {
  initialize<T>(databaseName: string): Promise<CmRDT<T>>;
}

export abstract class CmRDT<T> {
  abstract getTransaction(storeNames: string | Iterable<string>, mode?: IDBTransactionMode): [CmRDTTransaction<T>, Promise<void>];

  // TODO FIXME make this mostly usable from both sides
  // remote needs to already be connected - maybe this should be initiated from a sync command?
  async syncWithRemote(remote: Remote<T>): Promise<void> {
    // TODO FIXME actually implement this :D

    // the part above this line does efficient-syncing which means only things are synced where one node knows
    // everything it needs to send to get another node up to date. In most practical cases this should work.
    // if both nodes did changes you normally need to fallback to "backwards-syncing". Maybe a heuristic with "fake-heads"
    // could be implemented so if you add changes locally you also send the base because that is what most remotes likely know.
    // --------------------------------------
    // the part below this line does "backwards-syncing" which *should* work in all cases.
    
    // this approach just sends unknown nodes backwards until you reach a known node
    // this means you need to trust the peer to not send you garbage as it could've just generated a big graph of random nodes that it sends to you
    // see below for some ideas to circumvent this but there wasn't any similarily efficient way.

    // send your heads to the other peer. you will then find unknown hashes in their heads which you can request
    let remoteHeadHashesRequest = remote.headHashes.request();
    let [transaction1, done1] = this.getTransaction(["heads"], "readonly")
    let missingHeadsForRemoteRequest = remote.sendHashes(await transaction1.getHeads()); // maybe split up request
    let missingEntryHashesForRemoteRequest = remote.requestMissingEntryHashesForRemote()
    await done1

    remote.flushRequests();

    let potentiallyUnknownHashes: Set<ArrayBuffer> = await remoteHeadHashesRequest; // TODO FIXME an attacker could send large amounts of this, TODO FIXME also send n of their predecessors for efficiency
    await missingHeadsForRemoteRequest;
    let missingEntriesForRemote = await missingEntryHashesForRemoteRequest;

    let [transaction2, done2] = this.getTransaction(["log"], "readonly")
    let unknownHashes = [...potentiallyUnknownHashes].filter(transaction2.contains)
    let missingEntries: Array<CmRDTLogEntry<T>> = []
    let predecessors: Set<ArrayBuffer> = new Set()
    await done2

    while (potentiallyUnknownHashes.size > 0) {
      // TODO FIXME combine all transactions that can be combined?
      let [transaction, done] = this.getTransaction(["log"], "readonly")

      await transaction.insertEntries(missingEntries)

      potentiallyUnknownHashes = new Set([...missingEntries.flatMap(entry => entry.previousHashes), ...predecessors])

      unknownHashes = [...potentiallyUnknownHashes].filter(transaction.contains)
      await done

      let sendMissingEntriesRequest = remote.requestEntries(unknownHashes)
      let sendMyEntriesToRemoteRequest = remote.sendEntries(await transaction.getEntries(missingEntriesForRemote))
      let missingEntriesForRemoteRequest = remote.requestMissingEntryHashesForRemote()
      let predecessorsForMissingEntriesRequest = remote.requestPredecessors(unknownHashes, 3);
      remote.flushRequests()

      missingEntries = await sendMissingEntriesRequest
      await sendMyEntriesToRemoteRequest;
      missingEntriesForRemote = await missingEntriesForRemoteRequest
      predecessors = await predecessorsForMissingEntriesRequest // TODO FIXME use
    }
  }
}

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
      await Promise.all(entry.previousHashes.map(h => this.handleRequest(headsObjectStore.delete(h))))
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

  getTransaction(storeNames: Iterable<string>, mode?: IDBTransactionMode): [CmRDTTransaction<T>, Promise<void>] {
    const transaction = this.idbDatabase.transaction(storeNames, mode);
    const done = new Promise<void>((resolve, reject) => {
      transaction.addEventListener('abort', () => {
        console.warn(transaction.error)
        resolve() // aborting was likely done explicitly so this SHOULD be fine
      })
      transaction.addEventListener('complete', () => {
        resolve()
      })
      transaction.addEventListener('error', (event) => {
        event.stopPropagation()
        reject(transaction.error)
      })
    })
    return [new IndexedDBCmRDTTransaction<T>(transaction), done]
  }
}

// vector clocks
// list of entries with vector clocks
// peer peer peer peer
// 1    0    0    0    +{1} author signature (nobody knows that the order is correct)
// 0    0    0    1    +{2}
// causally afterwards:
// 1    0    1    0    +{3}
// 1    1    1    1    -{3}

// likely major advantage of DAG is that causality can be proven
// but only in one direction (you can still add entries to the past)
// but not to the future

// with DAG you can purposely not base your change on somebody else's e.g if you don't trust them

// TODO postgresql implementation

// binary based protocol for efficiency

// alternative implementation with history (simplest true wins case)
// store the following:
// identifier value previous-hashes

export async function createLogEntry<T>(
  signKey: CryptoKeyPair,
  value: T,
  previousHashes: ArrayBuffer[],
): Promise<CmRDTLogEntry<T>> {
  const objectHash = await hashObject(value);
  const author = await exportPublicKey(signKey);
  const random = crypto.getRandomValues(new Uint8Array(64));
  const everything = new Uint8Array(
      author.byteLength +
      objectHash.byteLength +
      random.byteLength +
      previousHashes.reduce<number>((prev, curr) => prev + curr.byteLength, 0),
  );
  everything.set(new Uint8Array(author), 0);
  everything.set(new Uint8Array(objectHash), author.byteLength);
  everything.set(random, author.byteLength + objectHash.byteLength);
  previousHashes.reduce<number>((prev, curr) => {
    everything.set(new Uint8Array(curr), prev);
    return prev + curr.byteLength;
  }, author.byteLength + objectHash.byteLength + random.byteLength);
  const hash = await hashArrayBuffer(everything);

  const entry: CmRDTLogEntry<T> = {
    author: author, // TODO use the user database, then we can use a hash of it's public key / the entry in that database. This may also be pretty bad as then everybody knows of all users.
    hash: hash, // we don't need to transmit this as it can be calculated from the remaining data
    random: random, // this is to allow adding the same data twice. (maybe put this into data directly?)
    value: value,
    previousHashes: previousHashes,
    // TODO sign the entry somehow that you could publish a secret to let anyone sign it when you delete the entry. Then nobody can prove what the (~~original contents where~~) that you signed it.
    signature: await sign(signKey, everything),
  };
  return entry;
}

export async function logToState<S, T>(currentState: S, remainingLog: CmRDTLog<T>, addLogEntryToState: (state: S, entry: CmRDTLogEntry<T>) => S): Promise<S> {
  return remainingLog.reduce((previousValue, currentValue) => {
    return addLogEntryToState(previousValue, currentValue);
  }, currentState)
}

// TODO FIXME store name, role and signed identity somewhere to allow verification
// this could be send on connect, but for updates you would also need to send this if the user is not known to the other person
// maybe another table which contains that data as key value or so
// key value could have the advantage that a client can only request keys it knows about.

// maybe a database which contains all trusted "servers" which is also updated like this

// user database:

// initial element is added client-side

// entry: author: server-key, value: add-op server-key type:server, signature: self-signed by server

// then all currently trusted SERVER keys can use add-op and remove-op to add and remove keys
// roles: type:server, type:admin, type:manager, type:user

// also contains password, etc. but this is only send between servers and admins
