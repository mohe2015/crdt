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
export {}

// binary based protocol for efficiency

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

type CmRDTLogEntry<T> = Readonly<{value: T, hash: string, previousHashes: string[], author: ArrayBuffer, signature: ArrayBuffer }>;

type CmRDTLog<T> = Readonly<CmRDTLogEntry<T>[]>

const firstEntry: CmRDTLogEntry<number> = {value: 1, hash: "a", previousHashes: [], author: new ArrayBuffer(0), signature: new ArrayBuffer(0) }

const fork1Entry: CmRDTLogEntry<number> = {value: 2, hash: `b[${firstEntry.hash}]`, previousHashes: [firstEntry.hash], author: new ArrayBuffer(0), signature: new ArrayBuffer(0)}

const fork2Entry: CmRDTLogEntry<number> = {value: 3, hash: `c[${firstEntry.hash}]`, previousHashes: [firstEntry.hash], author: new ArrayBuffer(0), signature: new ArrayBuffer(0)}

const mergeEntry: CmRDTLogEntry<number> = {value: 2.5, hash: `d[${fork1Entry.hash}][${fork2Entry.hash}]`, previousHashes: [fork1Entry.hash, fork2Entry.hash], author: new ArrayBuffer(0), signature: new ArrayBuffer(0)}

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