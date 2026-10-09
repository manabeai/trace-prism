{ pkgs ? import <nixpkgs> { } }:
let
  linker = "${pkgs.stdenv.cc}/bin/cc";
  cargoLinkerVariable =
    "CARGO_TARGET_${pkgs.lib.toUpper (builtins.replaceStrings [ "-" ] [ "_" ] pkgs.stdenv.hostPlatform.config)}_LINKER";
in
pkgs.mkShell {
  packages = with pkgs; [
    pkg-config
    gtk3
    webkitgtk_4_1
    librsvg
    openssl
  ];

  shellHook = ''
    export CC="${linker}"
    export CXX="${pkgs.stdenv.cc}/bin/c++"
    export ${cargoLinkerVariable}="${linker}"
  '';
}
