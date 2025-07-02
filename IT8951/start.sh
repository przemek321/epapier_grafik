#!/bin/bash

# Przejdz do katalogu ze sterownikiem IT8951
cd "$(dirname "$0")" || {
    echo "Nie mozna przejsc do katalogu IT8951"
    exit 1
}

# Uruchom komende ze wszystkimi uprawnieniami
sudo ./epd -2.39 0