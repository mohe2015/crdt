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

type CmRDTLog<T> = Readonly<CmRDTLogEntry<T>[]>;

interface CmRDTFactory {
  initialize<T>(): Promise<CmRDT<T>>;
}

interface CmRDT<T> {
  insertEntry(entry: CmRDTLogEntry<T>): Promise<void>;


}

class IndexedDBCmRDTFactory implements CmRDTFactory {

  initialize<T>() {
    return new Promise<IndexedDBCmRDT<T>>((resolve, reject) => {
      const request = indexedDB.open("cmrdt", 2)
      request.addEventListener("upgradeneeded", () => {
        const objectStore = request.result.createObjectStore("log", {
          autoIncrement: true,
        });
        objectStore.createIndex("hash", "hash", {
          multiEntry: false,
          unique: true
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

class IndexedDBCmRDT<T> implements CmRDT<T> {
  idbDatabase: IDBDatabase;

  constructor(idbDatabase: IDBDatabase) {
    this.idbDatabase = idbDatabase;
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

  getTransaction(storeNames: string | Iterable<string>, mode?: IDBTransactionMode): [IDBTransaction, Promise<void>] {
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
    return [transaction, done]
  }

  // NEW DATABASE DESIGN
  // out of line auto-incrementing integer primary key | value | hash | previous | author | signature
  // always store in topological order

  async insertEntry(entry: CmRDTLogEntry<T>): Promise<void> {
    const [transaction, done] = this.getTransaction(["log"], "readwrite");
    const objectStore = transaction.objectStore("log");
    await this.handleRequest(objectStore.add(entry));
    await done
  }

  // index.openCursor(null, 'prev');
  // collect elements (maybe as an iterator). store their previousHashes. if you got all previousHashes you found all heads?
  async getHeads(): Promise<void> {
    // TODO
  }

  async getEntriesBefore(heads: ArrayBuffer[]) {
    // TODO
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
  const cmrdt = await (new IndexedDBCmRDTFactory()).initialize<{operation: string, value: ArrayBuffer}|null>();

  const server1Key = await generateKey();
  const user1Key = await generateKey();

  const usersMapRoot = await createLogEntry(server1Key, null, []);

  await cmrdt.insertEntry(usersMapRoot);

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