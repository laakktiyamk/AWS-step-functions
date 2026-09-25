#!/bin/bash
set -e
export DOCKER_DEFAULT_PLATFORM=linux/amd64
export BUILDX_NO_DEFAULT_PROVENANCE=1

echo "Building TypeScript..."
npx tsc -p tsconfig.json

echo "Logging to ECR..."
aws ecr get-login-password --region eu-north-1 --profile AWS-step-functions | docker login --username AWS --password-stdin 223057859479.dkr.ecr.eu-north-1.amazonaws.com

echo "Login Succeeded, deploying..."
DOCKER_BUILDKIT=0 npx serverless deploy --aws-profile AWS-step-functions