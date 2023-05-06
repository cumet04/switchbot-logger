#!/bin/bash

set -eo pipefail

# MEMO: サービスアカウントはコンソールなどで別途つける

gcloud functions deploy recorder \
  --gen2 \
  --trigger-http \
  --allow-unauthenticated \
  --region=asia-northeast1 \
  --runtime=go120 \
  --source=. \
  --env-vars-file env.yaml \
  --entry-point=HandleFunc
