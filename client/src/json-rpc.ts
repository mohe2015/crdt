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

// https://www.jsonrpc.org/specification
// not completely standards compliant, more minimal

export type JSONRPCRequests<P> = Array<JSONRPCRequest<P>>

export type JSONRPCRequest<P> = {
    method: string,
    params: P,
    id: string
}

export interface JSONRPCSuccessfulResponse<R> {
    id: string,
    result: R,
} 

export interface JSONRPCFailedResponse<E> {
    id: string,
    error: E,
}

export interface JSONRPCError<D> {
    code: number,
    message: string,
    data: D
}

// dont use directly if possible
export type JSONRPCResponse<R, E> = JSONRPCSuccessfulResponse<R> | JSONRPCFailedResponse<E>;

export type JSONRPCResponses<R, E> = Array<JSONRPCResponses<R, E>>

export async function transmit<P, R, E>(requests: JSONRPCRequests<P>): Promise<JSONRPCResponses<R, E>> {
    // TODO FIXME
    return null as any
}

export type JSONRPCRequestWithResponse<P, R, E> = {
    request: JSONRPCRequest<P>,
    response: JSONRPCResponse<R, E>
}