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

import { readFileSync, existsSync } from 'fs';
import { createSecureServer } from 'http2';
import WebSocket from 'isomorphic-ws';
import { WebSocketRemote } from '@dev.mohe/crdt-lib/src/remote'
import { PostgresCmRDTFactory } from '@dev.mohe/crdt-lib/src/postgres';

// TODO check origin - return 403 if forbidden or not existent

// TODO https://nodejs.org/api/http2.html

async function main() {
    let cert: string, key: string;
    if (existsSync("cert.pem") && existsSync("key.pem")) {
        cert = readFileSync("cert.pem").toString()
        key = readFileSync("key.pem").toString()
    } else {
        /*let keyPair = await generateKey()

        const exportedPrivKey = Buffer.from(String.fromCharCode.apply(null, Array.from(new Uint8Array(await exportPrivateKey(keyPair))))).toString('base64');
        key = `-----BEGIN RSA PRIVATE KEY-----\n${exportedPrivKey}\n-----END RSA PRIVATE KEY-----`;

        const exportedPubKey = Buffer.from(String.fromCharCode.apply(null, Array.from(new Uint8Array(await exportPublicKey(keyPair))))).toString('base64');
        cert = `-----BEGIN CERTIFICATE-----\n${exportedPubKey}\n-----END CERTIFICATE-----`;

        writeFileSync("key.pem", key)
        writeFileSync("cert.pem", cert)

        console.log("generated certificate")*/

        // nix run nixpkgs#openssl -- req -nodes -new -x509 -keyout key.pem -out cert.pem
        console.log("missing cert.pem && key.pem")
        return;
    }

    console.log(cert)
    console.log(key)

    const server = createSecureServer({
        cert,
        key,
        allowHTTP1: true,
    }, (req, res) => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          httpVersion: req.httpVersion
        }));
    });
    // @ts-expect-error
    const wss = new WebSocket.Server({ server });

    const cmrdt = await (new PostgresCmRDTFactory()).initialize<{operation: string, value: ArrayBuffer}|null>("crdt");
    console.log(cmrdt)

    wss.on('connection', async (ws, req) => {
        const ip = req.socket.remoteAddress;
        
        const remote = new WebSocketRemote<any>(cmrdt, ws);
        remote.handleRequests()
    });

    server.listen(8888);
}

main()