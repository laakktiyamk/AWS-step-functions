#!/usr/bin/env bash
# Tilin poiston datatesti.
#
# Käyttö:
#   ./check-deletion.sh before    # tilannekuva ennen poistoa
#   ./check-deletion.sh after     # tarkistus poiston jälkeen
#
# Asetukset luetaan tiedostosta .env.deletion-test (tai ENV_FILE=...):
#   MONGO_URI="mongodb+srv://..."
#   EMAIL="testi@osoite.fi"
#   DB_NAME="..."          # valinnainen, jos tietokanta ei ole URI:ssa
set -euo pipefail

MODE="${1:-}"
if [[ "$MODE" != "before" && "$MODE" != "after" ]]; then
  echo "Käyttö: $0 before|after"
  exit 1
fi

ENV_FILE="${ENV_FILE:-.env.deletion-test}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Asetustiedostoa $ENV_FILE ei löydy"
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${MONGO_URI:?MONGO_URI puuttuu tiedostosta $ENV_FILE}"
if [[ "$MODE" == "before" ]]; then
  : "${EMAIL:?EMAIL puuttuu tiedostosta $ENV_FILE}"
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MODE="$MODE" mongosh "$MONGO_URI" --quiet --file "$SCRIPT_DIR/check-account-deletion.js"
