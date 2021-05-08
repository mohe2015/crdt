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

      # sudo nixos-container create     crdt-psql --flake .#crdt-postgresql
      # sudo nixos-container start      crdt-psql
      # sudo nixos-container root-login crdt-psql
      # sudo nixos-container stop       crdt-psql
      # sudo nixos-container update     crdt-psql --flake .#crdt-postgresql # maybe stop before?
      # psql -h crdt-psql -U crdt
      nixosConfigurations.crdt-postgresql = nixpkgs.lib.nixosSystem {
        inherit system;
        modules = [
          ({ config, ... }: {
            boot.isContainer = true;

            networking.hostName = "crdt-psql";

            services.postgresql = {
              enable = true;
              package = pkgs.postgresql_13;
              enableTCPIP = true;
              authentication = "hostnossl crdt crdt 10.233.1.1 255.255.255.255 scram-sha-256";
              settings = {
                "password_encryption" = "scram-sha-256";
              };
            };
            networking.firewall.allowedTCPPorts = [ 5432 ];

            systemd.services.crdt-init = {
              after = [ "postgresql.service" ];
              wantedBy = [ "multi-user.target" ];

              serviceConfig = {
                Type = "oneshot";
                User = "postgres";
                Group = "postgres";
                ExecStart = let psqlSetupCommands = pkgs.writeText "crdt-init.sql" ''
                  SELECT 'CREATE ROLE "crdt" LOGIN PASSWORD ''\'''\'crdt''\'''\'' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'crdt')\gexec
                  SELECT 'CREATE DATABASE "crdt" OWNER "crdt" TEMPLATE template0 ENCODING UTF8' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'crdt')\gexec
                  \c 'crdt'
                ''; in "${config.services.postgresql.package}/bin/psql -f ${psqlSetupCommands}";
              };
            };

            system.stateVersion = "21.05";
          })
        ];
      };
    };
}
