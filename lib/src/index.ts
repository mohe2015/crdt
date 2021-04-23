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

// the database should probably also store the current state of things - which may duplicate data
// but then all accesses are way more efficient

import stringify from 'fast-json-stable-stringify';
import {
  exportPublicKey,
  hashArrayBuffer,
  sign,
} from './crypto';
import crypto from '@dev.mohe/isomorphic-webcrypto';
import type { Remote } from './remote';

// TODO use https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist

export abstract class CmRDTTransaction<T> {

  abstract getEntries(hashes: Set<ArrayBuffer>): Promise<Set<CmRDTLogEntry<any>>>;

  abstract getHeads(): Promise<Set<ArrayBuffer>>;

  abstract insertEntries(entries: Set<CmRDTLogEntry<T>>): Promise<void>;

  abstract contains(hash: ArrayBuffer): Promise<boolean>
}

export type CmRDTLogEntry<T> = Readonly<{
  value: T;
  hash: ArrayBuffer;
  random: ArrayBuffer;
  previousHashes: Set<ArrayBuffer>;
  author: ArrayBuffer;
  signature: ArrayBuffer;
}>;

export type CmRDTLog<T> = Readonly<CmRDTLogEntry<T>[]>;

export interface CmRDTFactory {
  initialize<T>(databaseName: string): Promise<CmRDT<T>>;
}

export abstract class CmRDT<T> {
  abstract transaction<T>(storeNames: Iterable<string>, mode: IDBTransactionMode, cb: (transaction: CmRDTTransaction<T>) => Promise<T>): Promise<T>;

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

    let heads = await this.transaction<Set<ArrayBuffer>>(["heads"], "readonly", async (transaction) => {
      return await transaction.getHeads()
    })

    await remote.sendHashes.request(heads);

    let potentiallyUnknownHashes: Set<ArrayBuffer> = await remote.headHashes.request(); // TODO FIXME an attacker could send large amounts of this, TODO FIXME also send n of their predecessors for efficiency
    let missingEntryHashesForRemote = await remote.requestHashesOfMissingEntries.request()
    let missingEntriesForRemote: Set<CmRDTLogEntry<T>> = new Set()

    let unknownHashes: Set<ArrayBuffer> = await this.transaction(["log"], "readonly", async (transaction) => {
      return new Set([...(await Promise.all([...potentiallyUnknownHashes].map(async (e): Promise<[ArrayBuffer, boolean]> => [e, await transaction.contains(e)]))).filter(e => e[1]).map(e => e[0])]);
    })
    let missingEntries: Set<CmRDTLogEntry<T>> = new Set()
    let predecessors: Set<ArrayBuffer> = new Set()

    while (potentiallyUnknownHashes.size > 0) {
      // TODO FIXME combine all transactions that can be combined?
      this.transaction(["log"], "readonly", async (transaction) => {
        await transaction.insertEntries(missingEntries)

        potentiallyUnknownHashes = new Set([...[...missingEntries].flatMap(entry => [...entry.previousHashes]), ...predecessors])
  
        unknownHashes = new Set([...(await Promise.all([...potentiallyUnknownHashes].map(async (e): Promise<[ArrayBuffer, boolean]> => [e, await transaction.contains(e)]))).filter(e => e[1]).map(e => e[0])])

        missingEntriesForRemote = await transaction.getEntries(missingEntryHashesForRemote)
      })
     
      await remote.sendEntries.request(missingEntriesForRemote)
      missingEntries = await remote.requestEntries.request(unknownHashes)
      missingEntryHashesForRemote = await remote.requestHashesOfMissingEntries.request()
      predecessors = await remote.requestPredecessors.request(unknownHashes);
    }
  }
}

function cmrdtLogEntrySize<T>(entry: CmRDTLogEntry<T>): number {
  return stringify(entry.value).length + entry.hash.byteLength + entry.random.byteLength + [...entry.previousHashes].map(a => a.byteLength).reduce((prev, curr) => prev + curr) + entry.author.byteLength + entry.signature.byteLength
}

export async function hashObject<T>(object: T): Promise<ArrayBuffer> {
  const stringified = stringify(object);
  const enc = new TextEncoder();
  return await crypto.subtle.digest('SHA-512', enc.encode(stringified));
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
  previousHashes: Set<ArrayBuffer>,
): Promise<CmRDTLogEntry<T>> {
  const objectHash = await hashObject(value);
  const author = await exportPublicKey(signKey);
  const random = crypto.getRandomValues(new Uint8Array(64));
  const everything = new Uint8Array(
      author.byteLength +
      objectHash.byteLength +
      random.byteLength +
      [...previousHashes].reduce<number>((prev, curr) => prev + curr.byteLength, 0),
  );
  everything.set(new Uint8Array(author), 0);
  everything.set(new Uint8Array(objectHash), author.byteLength);
  everything.set(random, author.byteLength + objectHash.byteLength);
  [...previousHashes].reduce<number>((prev, curr) => {
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
