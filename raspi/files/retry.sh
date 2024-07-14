#!/bin/bash

source ./record.env

ls /tmp/out_20*.json | while read file; do
  curl -u $BASIC_USER:$BASIC_PASS --fail --data-binary @$file $RECORD_URL && rm $file
done
