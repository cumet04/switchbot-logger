#!/bin/bash

set -eo pipefail

host=$TARGET_USER@$TARGET_HOST
today=$(date +%Y%m%d_%H%M%S)

scp -r dist "$host:/tmp/recorder_$today"

ssh $host <<EOS
mv /tmp/recorder_$today /opt/recorder/$today
ln -snf $today /opt/recorder/current
sudo ln -sf /opt/recorder/current/recorder.service /etc/systemd/system/recorder.service
sudo systemctl daemon-reload
sudo systemctl restart recorder
EOS
