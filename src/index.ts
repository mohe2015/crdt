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

// use a public key so the change is also signed (allows decentralized replication in the future)
// sign it by the server

// https://github.com/yjs/yjs
// https://www.youtube.com/watch?v=0l5XgnQ6rB4&feature=youtu.be

export type Node = string

export type GrowOnlyCounter = { [id: string]: number | undefined }

export function valueOfReplicatedCounter(replicatedCounter: GrowOnlyCounter) {
  let value = 0
  for (const nodeId in replicatedCounter) {
    value += replicatedCounter[nodeId]!
  }
  return value
}

export function mergeReplicatedCounter(a: GrowOnlyCounter, b: GrowOnlyCounter): GrowOnlyCounter {
  const object: GrowOnlyCounter = {}
  for (var nodeId in a) {
    object[nodeId] = a[nodeId]
  }
  for (var nodeId in b) {
    if (b[nodeId]! > (object[nodeId] || 0)) {
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



export type FalseWins = boolean

export function mergeFalseWins(a: FalseWins, b: FalseWins) {
  return a && b
}



export type TrueWins = boolean

export function mergeTrueWins(a: TrueWins, b: TrueWins) {
  return a || b
}





export type LastWriterWins = [object: any, id: string, vectors: { [id: string]: number | undefined }]

export function valueOfLastWriterWins(lastWriterWins: LastWriterWins) {
  return lastWriterWins[0];
}

export function mergeLastWriterWins(a: LastWriterWins, b: LastWriterWins): LastWriterWins {
  let aStrictlyGreaterThanB = false
  let aGreaterThanB = true
  let bStrictlyGreaterThanA = false
  let bGreaterThanA = true

  for (var nodeId in a[2]) {
    if (a[2][nodeId]! > (b[2][nodeId] || 0)) {
      aStrictlyGreaterThanB = true
    }
    if (a[2][nodeId]! < (b[2][nodeId] || 0)) {
      aGreaterThanB = false
    }
  }

  for (var nodeId in b[2]) {
    if (b[2][nodeId]! > (a[2][nodeId] || 0)) {
      bStrictlyGreaterThanA = true
    }
    if (b[2][nodeId]! < (a[2][nodeId] || 0)) {
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

export function updateLastWriterWins(lastWriterWins: LastWriterWins, id: string, value: any): LastWriterWins {
  return [value, id, Object.assign({}, lastWriterWins[2], {
    [id]: (lastWriterWins[2][id] || 0) + 1
  })]
}




export type GrowOnlySet = [lastId: number, value: { [id: string]: any }]

export function addToGrowOnlySet(growOnlySet: GrowOnlySet, id: string, add: any): GrowOnlySet {
  if ((id+(growOnlySet[0] + 1)) in growOnlySet) {
    throw new Error("internal consistency problem")
  }
  return [growOnlySet[0] + 1, Object.assign({}, growOnlySet[1], {
    [id+(growOnlySet[0] + 1)]: add
  })]
}

// TODO FIXME first one has to be self
export function mergeGrowOnlySet(self: GrowOnlySet, update: GrowOnlySet): GrowOnlySet {
  return [self[0], Object.assign({}, self[1], update[1])]
}





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