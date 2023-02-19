#!/bin/bash

set -eo pipefail

host=$TARGET_USER@$TARGET_HOST
today=$(date +%Y%m%d_%H%M%S)

scp -r src "$host:/tmp/scanner_$today"

ssh $host <<EOS
mv /tmp/scanner_$today /opt/scanner/$today
ln -snf $today /opt/scanner/current
sudo ln -sf /opt/scanner/current/scanner.service /etc/systemd/system/scanner.service
sudo systemctl daemon-reload
sudo systemctl restart scanner
EOS
