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
          pkgs.nodejs-16_x
          pkgs.nodePackages.npm-check-updates
        ];
      };
      # TODO FIXME can't set the timeout for imperative containers and this breaks

      # sudo nixos-container create crdt-psql --flake .#crdt-postgresql
      # sudo nixos-container start  crdt-psql
      # sudo nixos-container stop   crdt-psql
      # sudo nixos-container update crdt-psql --flake .#crdt-postgresql # maybe stop before?
      # psql -h crdt-psql -U crdt
      nixosConfigurations.crdt-postgresql = nixpkgs.lib.nixosSystem {
        inherit system;
        modules = [
          ({ ... }: {
            boot.isContainer = true;

            networking.hostName = "crdt-psql";

            services.postgresql = {
              enable = true;
              enableTCPIP = true; # ONLY use for containers that are protected from external networks
              authentication = "hostnossl crdt crdt 10.233.1.1 255.255.255.255 md5";
            };

            networking.firewall.allowedTCPPorts = [ 5432 ];

            system.stateVersion = "21.05";
          })
        ];
      };
    };
}
