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

import type { Serializable } from "./serialization";

export {}

// https://www.jsonrpc.org/specification
// not completely standards compliant, more minimal

export type JSONRPCRequests<P, P_ extends Serializable<P>> = Array<JSONRPCRequest<P, P_>>

export type JSONRPCRequest<P, P_ extends Serializable<P>> = {
    method: string,
    params: P,
    id: string
}

export interface JSONRPCSuccessfulResponse<R, R_ extends Serializable<R>> {
    id: string,
    result: R,
} 

export interface JSONRPCFailedResponse<E, E_ extends Serializable<E>> {
    id: string,
    error: E,
}

export interface JSONRPCError<D, D_ extends Serializable<D>> {
    code: number,
    message: string,
    data: D
}

// dont use directly if possible
export type JSONRPCResponse<R, R_ extends Serializable<R>, E, E_ extends Serializable<E>> = JSONRPCSuccessfulResponse<R, R_> | JSONRPCFailedResponse<E, E_>;

export type JSONRPCResponses<R, R_ extends Serializable<R>, E, E_ extends Serializable<E>> = Array<JSONRPCResponses<R, R_, E, E_>>

export async function transmit<P, P_ extends Serializable<P>, R, R_ extends Serializable<R>, E, E_ extends Serializable<E>>(requests: JSONRPCRequests<P, P_>): Promise<JSONRPCResponses<R, R_, E, E_>> {
    // TODO FIXME
    return null as any
}

export type JSONRPCRequestWithResponse<P, P_ extends Serializable<P>, R, R_ extends Serializable<R>, E, E_ extends Serializable<E>> = {
    request: JSONRPCRequest<P, P_>,
    response: JSONRPCResponse<R, R_, E, E_>
}

export type JSONRPCHandler<I, O> = {
    request: (i: I) => Promise<O>,
    respond: (i: object) => Promise<object>,
}