# SPDX-FileCopyrightText: 2020 Moritz Hedtke <Moritz.Hedtke@t-online.de>
#
# SPDX-License-Identifier: AGPL-3.0-or-later

{
  inputs = {
    crdt.url = "path:..";
  };

  outputs = { self, crdt }: crdt;
}
