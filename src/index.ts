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

// design:

// nodes: (a few servers, several hundred clients)

// use a public key so the change is also signed (allows decentralized replication in the future)
// sign it by the server

// currently just use a counter per node for its latest state
// this simple implementation probably uses too much storage


// https://github.com/yjs/yjs
// https://www.youtube.com/watch?v=0l5XgnQ6rB4&feature=youtu.be

type Node = string



type GrowOnlyCounter = { [id: string]: number | undefined }

function valueOfReplicatedCounter(replicatedCounter: GrowOnlyCounter) {
  let value = 0
  for (var nodeId in replicatedCounter) {
    value += replicatedCounter[nodeId]!
  }
  return value
}

function mergeReplicatedCounter(a: GrowOnlyCounter, b: GrowOnlyCounter): GrowOnlyCounter {
  let object: GrowOnlyCounter = {}
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

function incrementGrowOnlyCounter(growOnlyCounter: GrowOnlyCounter, id: string, increment: number): GrowOnlyCounter {
  return Object.assign({}, growOnlyCounter, {
    [id]: (growOnlyCounter[id] || 0) + increment
  })
}



type FalseWins = boolean

function mergeFalseWins(a: FalseWins, b: FalseWins) {
  return a && b
}



type TrueWins = boolean

function mergeTrueWins(a: TrueWins, b: TrueWins) {
  return a || b
}





type LastWriterWins = [object: any, id: string, vectors: { [id: string]: number | undefined }]

function valueOfLastWriterWins(lastWriterWins: LastWriterWins) {
  return lastWriterWins[0];
}

function mergeLastWriterWins(a: LastWriterWins, b: LastWriterWins): LastWriterWins {
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

function updateLastWriterWins(lastWriterWins: LastWriterWins, id: string, value: any): LastWriterWins {
  return [value, id, Object.assign({}, lastWriterWins[2], {
    [id]: (lastWriterWins[2][id] || 0) + 1
  })]
}




type GrowOnlySet = { [id: string]: any }






let node1: Node = "node1"
let counter1: GrowOnlyCounter = { [node1]: 2 }
console.log(counter1)
console.log(valueOfReplicatedCounter(counter1))

let node2: Node = "node2"
let counter2: GrowOnlyCounter = incrementGrowOnlyCounter(counter1, node2, 10)
console.log(counter2)
console.log(valueOfReplicatedCounter(counter2))

let counter12 = mergeReplicatedCounter(counter1, counter2)
console.log(counter12)
console.log(valueOfReplicatedCounter(counter12))


let lww1: LastWriterWins = ["Technik", node1, { [node1]: 1 }]
console.log("lww1", lww1)

let lww2 = updateLastWriterWins(lww1, node2, "Technik-AG")
console.log("lww2", lww2)

let lww12 = mergeLastWriterWins(lww1, lww2)
console.log("lww12", lww12)

let lww21 = mergeLastWriterWins(lww2, lww1)
console.log("lww21", lww21)

if (lww12 !== lww21) throw new Error("assert")

let lww211 = updateLastWriterWins(lww21, node1, "Technik")
console.log("lww211", lww211)

let lww212 = updateLastWriterWins(lww21, node2, "Technik AG")
console.log("lww212", lww212)

let lww21x = mergeLastWriterWins(lww211, lww212)
console.log("lww21x", lww21x)


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