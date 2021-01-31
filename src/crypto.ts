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
import { crypto } from './webcrypto';

export async function generateKey(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    {
      name: 'RSA-PSS',
      modulusLength: 4096,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-512',
    },
    true,
    ['sign', 'verify'],
  );
}

export async function sign(
  key: CryptoKeyPair,
  data: ArrayBuffer,
): Promise<ArrayBuffer> {
  return await crypto.subtle.sign(
    {
      name: 'RSA-PSS',
      saltLength: 512 / 8,
    },
    key.privateKey,
    data,
  );
}

export async function exportPrivateKey(
  key: CryptoKeyPair,
): Promise<ArrayBuffer> {
  return crypto.subtle.exportKey('pkcs8', key.privateKey);
}

export async function exportPublicKey(
  key: CryptoKeyPair,
): Promise<ArrayBuffer> {
  return crypto.subtle.exportKey('spki', key.publicKey);
}

export async function hashArrayBuffer(
  buffer: ArrayBuffer,
): Promise<ArrayBuffer> {
  return await crypto.subtle.digest('SHA-512', buffer);
}
