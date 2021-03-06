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
import type { CmRDT, CmRDTLogEntry } from "./index.js"
import type { JSONRPCHandler, JSONRPCRequest, JSONRPCResponse } from "./json-rpc.js"
import { Serializable, SetOfArrayBuffers, StringToErrorSerializer, Void } from "./serialization.js"
import WebSocket from 'isomorphic-ws';

// https://developer.mozilla.org/en-US/docs/Web/API
// https://developer.mozilla.org/en-US/docs/Web/API/Barcode_Detection_API
// https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API
// https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API
 
export abstract class Remote<T> {

  abstract headHashes: JSONRPCHandler<void, Set<ArrayBuffer>>

  abstract sendHashes: JSONRPCHandler<Set<ArrayBuffer>, void>

  abstract sendEntries: JSONRPCHandler<Set<CmRDTLogEntry<any>>, void>

  /**
   * This also validates that the remote sent a valid object.
   * @param keys the key to request from the remote
   */
  // https://developer.mozilla.org/en-US/docs/Web/API/Streams_API#concepts_and_usage
  // https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Concepts
  // https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams
  abstract requestEntries: JSONRPCHandler<Set<ArrayBuffer>, Promise<Set<CmRDTLogEntry<T>>>> // TODO FIXME maybe streaming

  abstract requestHashesOfMissingEntries: JSONRPCHandler<void, Set<ArrayBuffer>>

  abstract requestPredecessors: JSONRPCHandler<Set<ArrayBuffer>, Set<ArrayBuffer>>
}

export class WebSocketRemote<T> extends Remote<T> {
    socket!: WebSocket
    methods: Map<string, JSONRPCHandler<any, any>>
    cmrdt: CmRDT<T>

    constructor(cmrdt: CmRDT<T>, socket?: WebSocket) {
      super()
      this.cmrdt = cmrdt
      this.socket = socket!
      this.methods = new Map()
      this.methods.set("headHashes", this.headHashes)
    }
  
    connect(): Promise<void> {
      return new Promise((resolve, reject) => {
        this.socket = new WebSocket("wss://localhost:8888")
        //socket.binaryType = "blob" // vs arraybuffer
    
        this.socket.addEventListener("error", (event) => {
          console.error(event)
          reject()
        })
    
        this.socket.addEventListener("open", (event) => {
          console.log(event)
          resolve()
        })
      })
    }

    handleRequests(): void {
      this.socket.addEventListener("message", async (event) => {
        let request = JSON.parse(event.data)
  
        if (request.method) {
          console.log("request:", request)
          console.log("got method " + request.method)

          let method = this.methods.get(request.method);
          if (method) {
            console.log(method)

            let response: JSONRPCResponse = {
              id: request.id,
              result: await method.respond(request.params)
            }

            console.log("response: ", response)
            this.socket.send(JSON.stringify(response))
          }
        }
      })
      // TODO FIXME close on error
    }

    headHashes: JSONRPCHandler<void, Set<ArrayBuffer>> = {
      request: async (params) => {
        return await this.genericRequestHandler<void, Void, Set<ArrayBuffer>, SetOfArrayBuffers, Error, StringToErrorSerializer>("headHashes", new Void(), new SetOfArrayBuffers(), new StringToErrorSerializer())
      },
      respond: async (params: object) => {
        return await (this.genericResponseHandler<void, Void, Set<ArrayBuffer>, SetOfArrayBuffers, Error, StringToErrorSerializer>("headHashes", new Void(), new SetOfArrayBuffers(), new StringToErrorSerializer(), async () => {
          return await this.cmrdt.transaction(["heads"], "readonly", async (transaction) => {
            return await transaction.getHeads()
          })
        }))
      }
    }

    sendHashes: JSONRPCHandler<Set<ArrayBuffer>, void> = null!;
    sendEntries: JSONRPCHandler<Set<Readonly<{
      value: any; hash: ArrayBuffer; random: ArrayBuffer; previousHashes: Set<ArrayBuffer>; // https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Concepts
      // https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Concepts
      // https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams
      author: ArrayBuffer; signature: ArrayBuffer;
    }>>, void> = null!;
    requestEntries: JSONRPCHandler<Set<ArrayBuffer>, Promise<Set<Readonly<{
      value: T; hash: ArrayBuffer; random: ArrayBuffer; previousHashes: Set<ArrayBuffer>; // https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Concepts
      // https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Concepts
      // https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams
      author: ArrayBuffer; signature: ArrayBuffer;
    }>>>> = null!;
    requestHashesOfMissingEntries: JSONRPCHandler<void, Set<ArrayBuffer>> = null!;
    requestPredecessors: JSONRPCHandler<Set<ArrayBuffer>, Set<ArrayBuffer>> = null!;

    async genericResponseHandler<P, P_ extends Serializable<P>, R, R_ extends Serializable<R>, E extends Error, E_ extends Serializable<E>>(name: string, params: P_, result: R_, error: E_, callback: (i: P) => Promise<R>): Promise<object> {
      try {
        let response = await callback(params.get())
        result.set(response)
        return result.serialize()
      } catch (e) {
        error.set(e)
        return error.serialize()
      }
    }
  
    genericRequestHandler<P, P_ extends Serializable<P>, R, R_ extends Serializable<R>, E extends Error, E_ extends Serializable<E>>(name: string, params: P_, result: R_, error: E_): Promise<R> {
      return new Promise((resolve, reject) => {
        let id = crypto.getRandomValues(new Uint8Array(64)).reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');
        let request: JSONRPCRequest = {
          id: id,
          method: name,
          params: params.serialize()
        }
        console.log("request: ", request)
        this.socket.send(JSON.stringify(request));
  
        let onclose = (event: {
          wasClean: boolean; code: number;
          reason: string; target: WebSocket
        }) => {
          console.log(event)
  
          this.socket.removeEventListener("message", onmessage)
          this.socket.addEventListener("close", onclose)
  
          reject()
        }
  
        let onmessage = (event: { data: any; type: string; target: WebSocket }) => {
          console.log(event)
  
          // TODO FIXME put parsing into conditional check
          let response = JSON.parse(event.data)
          if (id === response.id) {
            this.socket.removeEventListener("message", onmessage) // TODO test if this works
            this.socket.addEventListener("close", onclose)
  
            console.log("response: ", response)

            if ('result' in response) {
                resolve(result.deserialize(response.result))
            } else {
                reject(error.deserialize(response.error))
            }
          }
        }
  
        this.socket.addEventListener("message", onmessage)
        this.socket.addEventListener("close", onclose)
      })
    }
  }
  
  abstract class WebRTCRemote<T> extends Remote<T> {
    // TODO https://www.w3.org/TR/webrtc/#perfect-negotiation-example
    // initial bootstrap needs to be manual so we don't depend on a server (for now at least)
    // as webrtc is quite complicated maybe provide alternative bootstrap using websockets (preferably with your own server)
  
    async connect(): Promise<void> {
      // https://www.w3.org/TR/webrtc/#simple-peer-to-peer-example
      let certificate = await RTCPeerConnection.generateCertificate({
        name: "RSASSA-PKCS1-v1_5",
        // @ts-expect-error
        modulusLength: 4096,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256"
      })
  
      // certificate.getFingerprints().map(f => f.value)
  
      let connection: RTCPeerConnection = new RTCPeerConnection({
        certificates: [certificate]
        // TODO ice servers
      })
  
      connection.addEventListener("icecandidate", (event) => console.log(JSON.stringify({candidate: event.candidate}))); // you need to send this to remote - maybe generate qr code?
  
      connection.addEventListener("icecandidateerror", console.error)
  
      document.querySelector<HTMLButtonElement>("#button")!.addEventListener("click", async (event) => {
        console.log("click")
        let value = JSON.parse(document.querySelector<HTMLInputElement>("#input")!.value);
        console.log(value)
        
        try {
          if (value.description) {
            await connection.setRemoteDescription(value.description);
            // if we got an offer, we need to reply with an answer
            if (value.description.type == 'offer') {
              // @ts-expect-error
              await connection.setLocalDescription();
              console.log(JSON.stringify({description: connection.localDescription}));
            }
          } else if (value.candidate) {
            await connection.addIceCandidate(value.candidate);
          }
        } catch (err) {
          console.error(err);
        }
      })
  
      let response: RTCSessionDescriptionInit = await connection.createOffer({})
      connection.setLocalDescription(response)
      console.log(JSON.stringify({description: response}));
    }
  
  }
  