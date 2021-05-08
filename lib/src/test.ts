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
import { exportPublicKey, generateKey } from './crypto.js';
import { CmRDTTransaction, createLogEntry } from './index.js';
import { IndexedDBCmRDTFactory } from './indexeddb.js';
import { WebSocketRemote } from './remote.js';

async function assertEqual<T>(actual: T, expected: T) {
    if (actual !== expected) {
        throw new Error(actual + " !== " + expected);
    }
}

async function test() {
    const cmrdt = await (new IndexedDBCmRDTFactory()).initialize<{operation: string, value: ArrayBuffer}|null>("a");

    const remote = new WebSocketRemote<any>(cmrdt);
    await remote.connect()
    remote.handleRequests()
    await remote.headHashes.request()
  
    const server1Key = await generateKey();
    const user1Key = await generateKey();
  
    const heads = await cmrdt.transaction(["heads"], "readonly", async (transaction: CmRDTTransaction<Set<ArrayBuffer>>) => {
      return await transaction.getHeads()
    })
    
    const usersMapRoot = await createLogEntry(server1Key, null, heads);
  
    await cmrdt.transaction(["log", "heads"], "readwrite", async (transaction) => {
      return await transaction.insertEntries(new Set([usersMapRoot]));
    })
  
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
      new Set(),
    );
  
    const createServer1Entry = await createLogEntry(
      server1Key,
      {
        operation: 'create',
        key: await exportPublicKey(server1Key),
        name: 'Server 1',
        role: 'server',
      },
      new Set(),
    );
  
    const usersMapEntry1 = await createLogEntry(
      server1Key,
      {
        operation: 'put',
        value: createServer1Entry.hash,
      },
      new Set([usersMapRoot.hash]),
    );
  
    const usersMapEntry2 = await createLogEntry(
      server1Key,
      {
        operation: 'put',
        value: createUser1Entry.hash,
      },
      new Set([usersMapEntry1.hash]),
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
      new Set([usersMapEntry2.hash]),
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