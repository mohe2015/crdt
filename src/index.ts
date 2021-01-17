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
//import equal from 'fast-deep-equal/es6';
import stringify from 'fast-json-stable-stringify';

/// <reference path="nodejs.d.ts" />
import { webcrypto as crypto } from 'crypto';


export async function hashObject<T>(object: T): Promise<string> {
  const stringified = stringify(object);
  const enc = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-512", enc.encode(stringified))
  const hashArray = Array.from(new Uint8Array(hashBuffer));                     // convert buffer to byte array
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join(''); // convert bytes to hex string
}

function intersect(a: string[], b: string[]) {
  const setB = new Set(b);
  return [...new Set(a)].filter(x => setB.has(x));
}




// TODO FIXME most of these should store a change history to allow tracking that and
// also to allow reverting





// use a public key so the change is also signed (allows decentralized replication in the future)
// sign it by the server

// https://github.com/yjs/yjs
// https://www.youtube.com/watch?v=0l5XgnQ6rB4&feature=youtu.be

export type Node = Readonly<string>

// https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type#Known_CRDTs

export type ModifiableGrowOnlyCounter = { [id: string]: number }
export type GrowOnlyCounter = Readonly<ModifiableGrowOnlyCounter>

export function valueOfGrowOnlyCounter(replicatedCounter: GrowOnlyCounter): number {
  return Object.values(replicatedCounter).reduce((prev, curr) => prev + curr)
}

export function mergeGrowOnlyCounter(a: GrowOnlyCounter, b: GrowOnlyCounter): GrowOnlyCounter {
  const object: ModifiableGrowOnlyCounter = {}
  for (const nodeId in a) {
    object[nodeId] = a[nodeId]
  }
  for (const nodeId in b) {
    if (b[nodeId] > (object[nodeId] || 0)) {
      object[nodeId] = b[nodeId]
    }
  }
  return object
}

export function incrementGrowOnlyCounter(growOnlyCounter: GrowOnlyCounter, id: string, increment: number): GrowOnlyCounter {
  return Object.assign({}, growOnlyCounter, {
    [id]: (growOnlyCounter[id] || 0) + increment
  })
}


export type PositiveNegativeCounter = Readonly<[positive: GrowOnlyCounter, negative: GrowOnlyCounter]>

export function valueOfPositiveNegativeCounter(positiveNegativeCounter: PositiveNegativeCounter): number {
  return valueOfGrowOnlyCounter(positiveNegativeCounter[0]) - valueOfGrowOnlyCounter(positiveNegativeCounter[1])
}

export function mergePositiveNegativeCounter(a: PositiveNegativeCounter, b: PositiveNegativeCounter): PositiveNegativeCounter {
  return [mergeGrowOnlyCounter(a[0], b[0]), mergeGrowOnlyCounter(a[1], b[1])]
}

export function addToPositiveNegativeCounter(positiveNegativeCounter: PositiveNegativeCounter, id: string, increment: number): PositiveNegativeCounter {
  return [incrementGrowOnlyCounter(positiveNegativeCounter[0], id, increment), positiveNegativeCounter[1]]
}

export function subtractFromPositiveNegativeCounter(positiveNegativeCounter: PositiveNegativeCounter, id: string, subtract: number): PositiveNegativeCounter {
  return [positiveNegativeCounter[0], incrementGrowOnlyCounter(positiveNegativeCounter[1], id, subtract)]
}


export type GrowOnlySet<T> = Readonly<{ [hash: string]: T }>

export async function addToGrowOnlySet<T>(growOnlySet: GrowOnlySet<T>, object: T): Promise<GrowOnlySet<T>> {
  const hashHex = await hashObject(object)
  return Object.assign({}, growOnlySet, {
    [hashHex]: object
  })
}

export async function valueOfGrowOnlySet<T>(growOnlySet: GrowOnlySet<T>): Promise<GrowOnlySet<T>> {
  return growOnlySet
}

export async function valueInGrowOnlySet<T>(growOnlySet: GrowOnlySet<T>, object: T): Promise<boolean> {
  const hashHex = await hashObject(object)
  return hashHex in growOnlySet
}

export async function mergeGrowOnlySet<T>(a: GrowOnlySet<T>, b: GrowOnlySet<T>): Promise<GrowOnlySet<T>> {
  return Object.assign({}, a, b)
}

export async function causalityCompareGrowOnlySet<T>(a: GrowOnlySet<T>, b: GrowOnlySet<T>): Promise<number> {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  const intersection = intersect(aKeys, bKeys)
  if (aKeys.length == bKeys.length && intersection.length == aKeys.length) return 0;
  if (aKeys.length == intersection.length) return -1;
  if (bKeys.length == intersection.length) return 1;
  throw new Error("hopefully unreachable") // TODO FIXME this should mean neither
}


// TODO FIXME remove may be a hash set
// remove wins
export type TwoPhaseSet<T> = Readonly<[add: GrowOnlySet<T>, remove: GrowOnlySet<T>]>

export async function valueInTwoPhaseSet<T>(twoPhaseSet: TwoPhaseSet<T>, object: T): Promise<boolean> {
  return (await valueInGrowOnlySet(twoPhaseSet[0], object)) && !(await valueInGrowOnlySet(twoPhaseSet[1], object))
}

export async function addToTwoPhaseSet<T>(twoPhaseSet: TwoPhaseSet<T>, object: T): Promise<TwoPhaseSet<T>> {
  return [await addToGrowOnlySet(twoPhaseSet[0], object), twoPhaseSet[1]]
}

export async function removeFromTwoPhaseSet<T>(twoPhaseSet: TwoPhaseSet<T>, object: T): Promise<TwoPhaseSet<T>> {
  // TODO FIXME maybe check if its in the add
  return [twoPhaseSet[0], await addToGrowOnlySet(twoPhaseSet[1], object)]
}

// comparison in respect to causality not size of set
export async function causalityCompareTwoPhaseSet<T>(a: TwoPhaseSet<T>, b: TwoPhaseSet<T>): Promise<number> {
  const add = await causalityCompareGrowOnlySet(a[0], b[0])
  const remove = await causalityCompareGrowOnlySet(a[1], b[1])
  if (add == remove) return add
  if (add == 0) return remove
  if (remove == 0) return add
  throw new Error("unkown causality")
  // -1 -1 = -1
  // -1  0 = -1
  // -1  1 = dontknow?/error?
  //  0 -1 = -1
  //  0  0 = 0
  //  0  1 = 1
  //  1 -1 = dontknow?/error?
  //  1  0 = 1
  //  1  1 = 1
}

/*
// FIXME this is more like a dictionary. also merging same keys with different values is not working properly
export type PerUserGrowOnlySet<T> = Readonly<[lastId: number, value: { [id: string]: T }]>//

export function addToGrowOnlySet<T>(growOnlySet: PerUserGrowOnlySet<T>, id: string, add: T): PerUserGrowOnlySet<T> {
  // key of every value is your id concatenated with an incrementing number
  // if this already exists something is wrong
  if ((id+(growOnlySet[0] + 1)) in growOnlySet) {
    throw new Error("internal consistency problem")
  }
  return [growOnlySet[0] + 1, Object.assign({}, growOnlySet[1], {
    [id+(growOnlySet[0] + 1)]: add
  })]
}

// TODO FIXME first one has to be self
export function mergeGrowOnlySet<T>(self: PerUserGrowOnlySet<T>, update: PerUserGrowOnlySet<T>): PerUserGrowOnlySet<T> {
  return [self[0], Object.assign({}, self[1], update[1])]
}
*/




export type FalseWins = Readonly<boolean>

export function mergeFalseWins(a: FalseWins, b: FalseWins): boolean {
  return a && b
}



export type TrueWins = Readonly<boolean>

export function mergeTrueWins(a: TrueWins, b: TrueWins): boolean {
  return a || b
}



// TODO FIXME probably bad implementation
export type LastWriterWins<T> = Readonly<[object: T, id: string, vectors: { [id: string]: number }]>

export function valueOfLastWriterWins<T>(lastWriterWins: LastWriterWins<T>): T {
  return lastWriterWins[0];
}

export function mergeLastWriterWins<T>(a: LastWriterWins<T>, b: LastWriterWins<T>): LastWriterWins<T> {
  let aStrictlyGreaterThanB = false
  let aGreaterThanB = true
  let bStrictlyGreaterThanA = false
  let bGreaterThanA = true

  for (const nodeId in a[2]) {
    if (a[2][nodeId] > (b[2][nodeId] || 0)) {
      aStrictlyGreaterThanB = true
    }
    if (a[2][nodeId] < (b[2][nodeId] || 0)) {
      aGreaterThanB = false
    }
  }

  for (const nodeId in b[2]) {
    if (b[2][nodeId] > (a[2][nodeId] || 0)) {
      bStrictlyGreaterThanA = true
    }
    if (b[2][nodeId] < (a[2][nodeId] || 0)) {
      bGreaterThanA = false
    }
  }

  if (aGreaterThanB && aStrictlyGreaterThanB) {
    return a
  } else if (bGreaterThanA && bStrictlyGreaterThanA) {
    return b
  } else if (a[1] > b[1]) {
    console.warn("conflict ", a, b)
    return a
  } else {
    console.warn("conflict ", b, a)
    return b
  }
}

export function updateLastWriterWins<T>(lastWriterWins: LastWriterWins<T>, id: string, value: T): LastWriterWins<T> {
  return [value, id, Object.assign({}, lastWriterWins[2], {
    [id]: (lastWriterWins[2][id] || 0) + 1
  })]
}




//export type MultiWriterValue<T>




// user count (just for fun)

// https://github.com/pfrazee/crdt_notes

// https://github.com/alangibson/awesome-crdt
// SUPER GOOD RESOURCE

// https://queue.acm.org/detail.cfm?id=2917756

// pretty good https://www.cs.rutgers.edu/~pxk/417/notes/clocks/index.html
/*
 To determine if two events are concurrent, do an element-by-element comparison of the corresponding timestamps. If each element of timestamp V is less than or equal to the corresponding element of timestamp W then V causally precedes W and the events are not concurrent. If each element of timestamp V is greater than or equal to the corresponding element of timestamp W then W causally precedes V and the events are not concurrent. If, on the other hand, neither of those conditions apply and some elements in V are greater than while others are less than the corresponding element in W then the events are concurrent. We can summarize it with the pseudocode:
*/

// https://haslab.wordpress.com/2011/07/08/version-vectors-are-not-vector-clocks/

// https://blog.separateconcerns.com/2017-05-07-itc.html

// https://scattered-thoughts.net/writing/causal-ordering/

// http://jtfmumm.com/blog/2015/11/17/crdt-primer-1-defanging-order-theory/
// TODO http://jtfmumm.com/blog/2015/11/24/crdt-primer-2-convergent-crdts/

// TODO https://github.com/ricardobcl/Dotted-Version-Vectors

// https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type
// state based

// vector clocks, dotted vector clocks

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


// alternative implementation with history (simplest true wins case)
// store the following:
// identifier value previous-hashes

// counter
// identifier add random-hash (to prevent merging of unrelated adds) previous-hashes (to prevent duplicate application)
//       5
//  +1       +2
// +2  +1   +1  +1
// merge merge merge
// 13

// grow only / two phase set
// {}
// +{"elephant"}  +{"blablub"}
// -{"blablub"}
// merge merge merge
// conflict, resolve by client id or some other ramdon shit / remove wins or whatever although this may easily allow readding

// last writer wins
// "hello"
// ="world"
// ="test"     ="jojo"
//      conflict, random resolution by id or timestamp or so

// multiple values
// "hello"
// ="test" = "jojo"
//    \      / 
//     \    /
//      \  /
//       \/
//      ="cat"   // this would be an explicit conflict resolution

type CmRDTLogEntry<T> = Readonly<{value: T, hash: string, previousHashes: string[] }>;

type CmRDTLog<T> = Readonly<CmRDTLogEntry<T>[]>

const firstEntry = {value: 1, hash: "a", previous: []}

const fork1Entry = {value: 2, hash: `b[${firstEntry.hash}]`, previous: [firstEntry.hash]}

const fork2Entry = {value: 3, hash: `c[${firstEntry.hash}]`, previous: [firstEntry.hash]}

const mergeEntry = {value: 2.5, hash: `d[${fork1Entry.hash}][${fork2Entry.hash}]`, previous: [fork1Entry.hash, fork2Entry.hash]}

console.dir(mergeEntry, { depth: null })

// heads can be found by looking for hashes that are not in any "previous"
// how to do this efficiently

// first entry has no previous

// synchronization: both clients send their heads
// both look for the entries and search for all entries after them
// send these

// 🚧 Binary keys are new in this edition. They are supported in Chrome 58, Firefox 51, and Safari 10.1. 🚧 
// database (indexeddb)
// hash(primary key (as ArrayBuffer))
// value as a normal value
// 

// required search strategies: find entry by hash (easy)
// finding heads: (TODO maybe store incremnting integer (use normal generator)) multiEntry

// topological sort? (should be automatic if we use hashes for dependencies?)
// var index = objectStore.index('revision');
// index.openCursor(null, 'prev'); 

// NEW DATABASE DESIGN
// out of line auto-incrementing integer primary key | value | hash | previous
// always store in topological order