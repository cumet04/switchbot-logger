#!/bin/bash

set -eo pipefail

cp /opt/scanner/out.json /tmp/out.json
truncate /opt/scanner/out.json --size 0

curl --fail --data-binary @/tmp/out.json {{ recorder_url }}
