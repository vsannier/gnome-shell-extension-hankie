#!/bin/sh

set -xe

gnome-extensions pack --force src
gnome-extensions install --force hankie@vsannier.github.com.shell-extension.zip
