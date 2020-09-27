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

/**
 * This file is just a silly example to show everything working in the browser.
 * When you're ready to start on your site, clear the file. Happy hacking!
 **/

import confetti from 'canvas-confetti';

confetti.create(document.getElementById('canvas') as HTMLCanvasElement, {
  resize: true,
  useWorker: true,
})({ particleCount: 200, spread: 200 });




// TODO FIXME crdt resolve partial order
/*
Note: totally-ordered timestamps are not trivial to implement. Vector clocks, for instance, only provide a partial order, as differing values can be equivalent. (Consider, for instance, <1,2> vs <2,1>, which signify concurrent events on two nodes.) A weak but simple solution is to use the addresses of the nodes in the ordering (node at "A" precedes the node at "B"). This provides a deterministic answer, and thus a total ordering, but it is not semantically meaningful to the application.
*/




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
title (string)
info (string)
place (string)
costs (decimal)
min_age (int)
max_age (int)
min_participants (int)
max_participants (int)
presentation_type (string)
requirements (string)
random_assignments (bool)
all of these first just setting values - show conflicts to user
user (TODO split up in types / allow changing type?):
name (string)
password [CRDT PROBLEM]
type (enum)
project_leader project
class string
age int
away bool
password_changed (bool -> converges to true)
in_projecct project
mostly just setting values - show conflicts to user / last writer wins - text could be merged
choice:
rank int
project project
user user
problem: constraints in a distributed system don't work
show the errors to users / admin
store locally in indexeddb
*/