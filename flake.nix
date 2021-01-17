# SPDX-FileCopyrightText: 2020 Moritz Hedtke <Moritz.Hedtke@t-online.de>
#
# SPDX-License-Identifier: AGPL-3.0-or-later

{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs";
  };

  outputs = { self, nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };
    in
    {
      devShell."x86_64-linux" = pkgs.mkShell {
        buildInputs = [
          pkgs.reuse
          pkgs.nodejs-15_x
          pkgs.nodePackages.npm-check-updates
        ];
      };
    };
}
