import type { CmRDTLogEntry } from "./index"
import type { JSONRPCFailedResponse, JSONRPCHandler, JSONRPCRequest, JSONRPCResponse, JSONRPCSuccessfulResponse } from "./json-rpc"
import { Serializable, SetOfArrayBuffers, StringSerializer, StringToErrorSerializer, Void } from "./serialization"

// https://developer.mozilla.org/en-US/docs/Web/API
// https://developer.mozilla.org/en-US/docs/Web/API/Barcode_Detection_API
// https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API
// https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API
  
export class WebSocketRemote<T> extends Remote<T> {
    socket!: WebSocket
    methods: Map<string, JSONRPCHandler<any, any>>
  
    constructor() {
      super()
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
          console.log("got method ")

          let method = this.methods.get(request.method);
          if (method) {
            this.socket.send(JSON.stringify(await method.respond(request.params)))
          }
        }
      })
    }
  
    headHashes: JSONRPCHandler<void, Set<ArrayBuffer>> = {
      request: async (params) => {
        return await this.genericRequestHandler<void, Void, Set<ArrayBuffer>, SetOfArrayBuffers, Error, StringToErrorSerializer>("headHashes", new Void(), new SetOfArrayBuffers(), new StringToErrorSerializer())
      },
      respond: async (params: object) => {
        return await (this.genericResponseHandler<void, Void, Set<ArrayBuffer>, SetOfArrayBuffers, Error, StringToErrorSerializer>("headHashes", new Void(), new SetOfArrayBuffers(), new StringToErrorSerializer(), async () => {
          // TODO FIXME this should be somewhere else so we don't repeat it
          return new Set([new ArrayBuffer(0)])
        }))
      }
    }

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
        this.socket.send(JSON.stringify(request));
  
        let onclose = (event: CloseEvent) => {
          console.log(event)
  
          this.socket.removeEventListener("message", onmessage)
          this.socket.addEventListener("close", onclose)
  
          reject()
        }
  
        let onmessage = (event: MessageEvent<string>) => {
          console.log(event)
  
          // TODO FIXME put parsing into conditional check
          let response = JSON.parse(event.data)
          if (id === response.id) {
            this.socket.removeEventListener("message", onmessage) // TODO test if this works
            this.socket.addEventListener("close", onclose)
  
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
  
  class WebRTCRemote<T> extends Remote<T> {
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
  
    flushRequests(): Promise<void> {
  
    }
  
    async sendHashes(heads: Array<ArrayBuffer>): Promise<void> {
  
    }
  
    async requestHeadHashes(): Promise<Set<ArrayBuffer>> {
  
    }
  
    async sendEntries(entries: Array<CmRDTLogEntry<any>>): Promise<void> {
  
    }
  
    async requestPredecessors(hashes: Array<ArrayBuffer>, depth: number): Promise<Set<ArrayBuffer>> {
      
    }
  
    /**
     * This also validates that the remote sent a valid object.
     * @param keys the key to request from the remote
     */
    // https://developer.mozilla.org/en-US/docs/Web/API/Streams_API#concepts_and_usage
    // https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Concepts
    // https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams
    async requestEntries(keys: Array<ArrayBuffer>): Promise<Array<CmRDTLogEntry<T>>> {
  
    }
  
    async requestMissingEntryHashesForRemote(): Promise<Set<ArrayBuffer>> {
  
    }
  }
  