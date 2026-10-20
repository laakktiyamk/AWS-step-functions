#!/usr/bin/env bash
# Käyttö: ./run-batch.sh batch2 100
set -e
aws lambda invoke \
  --function-name ndvi-pipeline-dev-mlStarter \
  --payload "{\"batchId\":\"$1\",\"size\":${2:-100}}" \
  --cli-binary-format raw-in-base64-out \
  --profile AWS-step-functions \
  --region eu-north-1 \
  /tmp/mlstarter-out.json > /dev/null
cat /tmp/mlstarter-out.json; echo