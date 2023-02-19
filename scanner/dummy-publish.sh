#!/bin/bash

SAMPLE_FILE="sample.out"

while true; do
  cat $SAMPLE_FILE | while read LINE; do
    echo "publish switchbot '$LINE'";
    sleep "0."$(($RANDOM % 10))
  done
done | docker compose --project-directory .. exec -T redis redis-cli >/dev/null

