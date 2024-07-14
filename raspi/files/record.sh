#!/bin/bash

set -eo pipefail

source $(dirname $0)/record.env

today=$(date +%Y%m%d_%H%M%S)

cp /opt/scanner/out.json /tmp/out_$today.json
truncate /opt/scanner/out.json --size 0

# stagingは先に実行かつバックグラウンドにして、stagingの失敗が本番に影響しないようにする
curl -u $STG_BASIC_USER:$STG_BASIC_PASS --fail --data-binary @/tmp/out_$today.json $STG_RECORD_URL &
curl -u $BASIC_USER:$BASIC_PASS --fail --data-binary @/tmp/out_$today.json $RECORD_URL
rm /tmp/out_$today.json
# curlで失敗した場合はtmpにファイルが残る (=リトライ可能)
