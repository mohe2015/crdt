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

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createServer } from 'https';
import { Server } from 'ws';
import { generateKey, exportPrivateKey, exportPublicKey } from '@dev.mohe/crdt-lib/src/crypto'

// TODO check origin - return 403 if forbidden or not existent

async function main() {
    let cert: string, key: string;
    if (existsSync("cert.pem") && existsSync("key.pem")) {
        cert = readFileSync("cert.pem").toString()
        key = readFileSync("key.pem").toString()
    } else {
        let keyPair = await generateKey()

        const exportedPrivKey = window.btoa(String.fromCharCode.apply(null, new Uint8Array(await exportPrivateKey(keyPair))));
        key = `-----BEGIN PRIVATE KEY-----\n${exportedPrivKey}\n-----END PRIVATE KEY-----`;

        const exportedPubKey = window.btoa(String.fromCharCode.apply(null, new Uint8Array(await exportPublicKey(keyPair))));
        cert = `-----BEGIN PUBLIC KEY-----\n${exportedPubKey}\n-----END PUBLIC KEY-----`;

        writeFileSync("key.pem", exportedPrivKey)
        writeFileSync("cert.pem", exportedPubKey)

        console.log("generated certificate")
    }

    const server = createServer({
        cert,
        key
    });
    const wss = new Server({ server });

    wss.on('connection', (ws, req) => {
        const ip = req.socket.remoteAddress;
        ws.on('message', (message) => {
            console.log('received: %s', message);
        });
        ws.send('something');
    });

    server.listen(8080);
}