#!/bin/bash

set -eo pipefail

python scanner.py | while read LINE; do
  echo "publish switchbot '$LINE'";
done | redis-cli
