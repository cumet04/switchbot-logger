#!/bin/bash

SCANNER="cat sample.out"
#SCANNER="sudo python3 scanner.py"

$SCANNER | while read LINE; do
  echo "publish ad '$LINE'";
  sleep "0."$(($RANDOM % 10))
done | docker compose --project-directory .. exec -T redis redis-cli >/dev/null
