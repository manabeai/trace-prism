{ pkgs ? import <nixpkgs> { } }:
let
  linker = "${pkgs.stdenv.cc}/bin/cc";
  cargoLinkerVariable =
    "CARGO_TARGET_${pkgs.lib.toUpper (builtins.replaceStrings [ "-" ] [ "_" ] pkgs.stdenv.hostPlatform.config)}_LINKER";
  runtimeLibraries = pkgs.lib.makeLibraryPath (with pkgs; [
    cairo
    dbus
    gdk-pixbuf
    glib
    gtk3
    libsoup_3
    librsvg
    openssl
    webkitgtk_4_1
  ]);
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
    export LD_LIBRARY_PATH="${runtimeLibraries}''${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
  '';
}
