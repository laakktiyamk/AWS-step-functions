#!/usr/bin/env bash
# Käyttö: ./ml/scripts/run-input.sh sf-inputs-2026/sf-input-03.json [toinen.json ...]
# Ajaa annetut tiedostot peräkkäin ja pysähtyy, jos jokin erä ei onnistu.
set -e

ARN="arn:aws:states:eu-north-1:223057859479:stateMachine:ndviWorkflow"
PROFILE="AWS-step-functions"
REGION="eu-north-1"

if [ $# -eq 0 ]; then
  echo "Käyttö: $0 tiedosto.json [tiedosto2.json ...]"
  exit 1
fi

for FILE in "$@"; do
  [ -f "$FILE" ] || { echo "Tiedostoa ei löydy: $FILE"; exit 1; }

  NAME="ml-$(basename "$FILE" .json)-$(date +%s)"
  echo "$(date +%H:%M:%S) Käynnistetään $FILE"

  EXEC_ARN=$(aws stepfunctions start-execution \
    --state-machine-arn "$ARN" \
    --name "$NAME" \
    --input "file://$FILE" \
    --profile "$PROFILE" --region "$REGION" \
    --query executionArn --output text)
  echo "  $EXEC_ARN"

  while true; do
    STATUS=$(aws stepfunctions describe-execution \
      --execution-arn "$EXEC_ARN" \
      --query status --output text \
      --profile "$PROFILE" --region "$REGION")
    [ "$STATUS" != "RUNNING" ] && break
    sleep 30
  done

  echo "$(date +%H:%M:%S)   tila: $STATUS"
  if [ "$STATUS" != "SUCCEEDED" ]; then
    echo "Erä $FILE epäonnistui, pysäytetään."
    exit 1
  fi
done

echo "Kaikki erät valmiit."