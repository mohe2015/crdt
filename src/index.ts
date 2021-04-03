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
} from './crypto.js';
import crypto from '@dev.mohe/isomorphic-webcrypto';

// TODO use https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist

export async function hashObject<T>(object: T): Promise<ArrayBuffer> {
  const stringified = stringify(object);
  const enc = new TextEncoder();
  return await crypto.subtle.digest('SHA-512', enc.encode(stringified));
}

type CmRDTLogEntry<T> = Readonly<{
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

type CmRDTLog<T> = Readonly<CmRDTLogEntry<T>[]>;

interface CmRDTFactory {
  initialize<T>(databaseName: string): Promise<CmRDT<T>>;
}

abstract class CmRDT<T> {
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
    let remoteHeadHashesRequest = remote.requestHeadHashes();
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

abstract class CmRDTTransaction<T> {

  abstract getEntries(entries: Set<ArrayBuffer>): Promise<Array<CmRDTLogEntry<any>>>;

  abstract getHeads(): Promise<ArrayBuffer[]>;

  abstract insertEntries(entries: Array<CmRDTLogEntry<T>>): Promise<void>;

  abstract contains(hash: ArrayBuffer): Promise<boolean>
}

interface Remote<T> {
  connect(): Promise<void>

  flushRequests(): void

  sendHashes(heads: Array<ArrayBuffer>): Promise<void>

  requestHeadHashes(): Promise<Set<ArrayBuffer>>

  sendEntries(entries: Array<CmRDTLogEntry<any>>): Promise<void>

  requestPredecessors(hashes: Array<ArrayBuffer>, depth: number): Promise<Set<ArrayBuffer>>

  /**
   * This also validates that the remote sent a valid object.
   * @param keys the key to request from the remote
   */
  // https://developer.mozilla.org/en-US/docs/Web/API/Streams_API#concepts_and_usage
  // https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Concepts
  // https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams
  requestEntries(keys: Array<ArrayBuffer>): Promise<Array<CmRDTLogEntry<T>>>; // TODO FIXME maybe streaming

  requestMissingEntryHashesForRemote(): Promise<Set<ArrayBuffer>>
}

class IndexedDBCmRDTTransaction<T> extends CmRDTTransaction<T> {
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
  async insertEntries(entries: Array<CmRDTLogEntry<T>>): Promise<void> {
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
  async getHeads(): Promise<ArrayBuffer[]> {
    const result = this.handleRequest(this.transaction.objectStore("heads").getAllKeys());
    return result as unknown as ArrayBuffer[]
  }

  /**
   * @requires transaction be readonly and accessing log
   * @param entries 
   * @returns 
   */
  async getEntries(entries: Set<ArrayBuffer>): Promise<Array<CmRDTLogEntry<any>>> {
    const logObjectStore = this.transaction.objectStore("log");
    const result = [...entries].map(hash => this.handleRequest(logObjectStore.get(hash)))
    return result as unknown as Array<CmRDTLogEntry<any>>
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

class IndexedDBCmRDTFactory implements CmRDTFactory {

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

class IndexedDBCmRDT<T> extends CmRDT<T> {
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

async function createLogEntry<T>(
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

async function logToState<S, T>(currentState: S, remainingLog: CmRDTLog<T>, addLogEntryToState: (state: S, entry: CmRDTLogEntry<T>) => S): Promise<S> {
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

async function test() {
  const cmrdt = await (new IndexedDBCmRDTFactory()).initialize<{operation: string, value: ArrayBuffer}|null>("a");

  const server1Key = await generateKey();
  const user1Key = await generateKey();

  const [transaction1, done1] = cmrdt.getTransaction(["heads"], "readonly")
  const heads = await transaction1.getHeads()
  await done1
  
  const usersMapRoot = await createLogEntry(server1Key, null, heads);

  const [transaction2, done2] = cmrdt.getTransaction(["log", "heads"], "readwrite")
  await transaction2.insertEntries([usersMapRoot]);
  await done2

  const createUser1Entry = await createLogEntry(
    server1Key,
    {
      operation: 'create',
      key: await exportPublicKey(user1Key),
      name: 'Moritz Hedtke',
      role: 'admin',
      passwordHash:
        'this-is-super-secret-and-should-not-be-sent-to-unauthorized-clients',
    },
    [],
  );

  const createServer1Entry = await createLogEntry(
    server1Key,
    {
      operation: 'create',
      key: await exportPublicKey(server1Key),
      name: 'Server 1',
      role: 'server',
    },
    [],
  );

  const usersMapEntry1 = await createLogEntry(
    server1Key,
    {
      operation: 'put',
      value: createServer1Entry.hash,
    },
    [usersMapRoot.hash],
  );

  const usersMapEntry2 = await createLogEntry(
    server1Key,
    {
      operation: 'put',
      value: createUser1Entry.hash,
    },
    [usersMapEntry1.hash],
  );

  //const entry2 = await createLogEntry(server1Key, 2, [entry1.hash])

  console.dir(usersMapRoot, { depth: null });
  console.dir(createUser1Entry, { depth: null });
  console.dir(usersMapEntry2, { depth: null });

  // implementation of map
  // create-entry key value (may be another log, maybe lazy, only store head hash there)
  // delete-entry key (maybe allow re-adding?, yes causality allows this)

  // gdpr compliance (right of deletion)
  // probably custom operations for every type are needed.
  // e.g. if there is a full update / override entry then the old entry could likely be removed

  // usersMap
  const usersMapPermanentlyDeleteEntry2 = await createLogEntry(
    server1Key,
    {
      operation: 'gdpr-delete',
      value: usersMapEntry2.hash,
    },
    [usersMapEntry2.hash],
  );


  // add hash of random and value
  // and then hash of that and author and previous hashes
  // deletion would remove the data, random but keep the hash
  // this would allow us to keep the record itself and the causality

  // probably the original hash should be kept in history but random and value should be removed
  // so the data can not be reconstructed. this of course breaks the cryptographic verifyability
  // this is likely pretty bad as it would allow malicious users to add fake entries
  // maybe just don't propagate that entry at all as it is not verified any more
  // but then chains based on it are broken

  // maybe actually an unverified entry is better (removing everything except hash also to identify the entry). All users that can write there are trusted anyways so this should be fine.
  // maybe the delete user should re-sign the deletion at least. then there is somebody to blame. (this makes sense as otherwise nobody could verify if it's allowed to be removed)
  // users can delete their own entries.

  // entry 1 is added
  // entry 2 based on entry 1 is added
  // entry 3 based on entry 1 is added
  // a deletion request for entry 1 based on entry 1 is added (this modifies the existing entry 1 to an empty entry with an invalid hash / special contents signed by the deleter)
  // the deletion request is propagated and all receivers SHALL delete the original content and replace it with the signed by the deleter entry.
  // if you sync from entry 0, you directly get the entry signed by the deleter and also the later deletion request. (this is more or less a remove-wins-set for all hashes, it commutes at deletion)

  // if you sync after entry 1 you apply the deletion request as soon as you get it.

  // this may break the contents of entries following entry 1 if they are based on it. the underlying merge strategy MUST be resilient to such things. therefore last writer wins etc. may be risky
  // as it may leak data that should not be leaked from the previous entry. further consequencdes need to be evaluated throughougly!
  // e.g. for text this may remove children that should not have been affected. the protocol SHOULD be designed to be resilient to that but the importance is that data MUST be deleted reliably if possible.

  // handle deleting a deletion request (creates a new deletion request for both the original and the deleted entry)


  /*
  biggest problem: HOW TO STORE IN DATABASE? / USE A DECENTRALIZED DATABASE?
  project:
  title (string)                      - plaintext (for now lww)
  info (string)                       - plaintext
  place (string)                      - plaintext
  costs (decimal)                     - last writer wins
  min_age (int)                       - last writer wins
  max_age (int)                       - last writer wins
  min_participants (int)              - last writer wins
  max_participants (int)              - lww
  presentation_type (string)          - plaintext
  requirements (string)               - plaintext
  random_assignments (bool)           - false wins

  all of these first just setting values - show conflicts to user

  user (TODO split up in types):
  name (string)                       - lww? / plaintext
  password [CRDT PROBLEM]             - lww?
  type (enum)                         - nonchangable
  project_leader project              - lastwriterwins / conflict? / log conflict
  class string                        - lww?
  age int                             - lww
  away bool                           - false wins
  password_changed (bool -> converges to true) - true wins
  in_project project                  - last writer wins / log conflict
  mostly just setting values - show conflicts to user / last writer wins - text could be merged

  choice: (this has to be done properly)
  rank int                            - last writer wins (time based as it is per user?)
  project project                     - unchanable
  user user                           - unchangeable
  delete: conflict 

  problem: constraints in a distributed system don't work
  show the errors to users / admin
  store locally in indexeddb
  */

}

test()