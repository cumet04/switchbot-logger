#!/bin/bash

set -eo pipefail

today=$(date +%Y%m%d_%H%M%S)

cp /opt/scanner/out.json /tmp/out_$today.json
truncate /opt/scanner/out.json --size 0

curl --fail --data-binary @/tmp/out_$today.json {{ recorder_url }}
rm /tmp/out_$today.json
# curlで失敗した場合はtmpにファイルが残る (=リトライ可能)
