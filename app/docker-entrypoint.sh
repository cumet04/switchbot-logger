#!/bin/bash

# NextJs & App Router & standalone modeで真っ当にランタイムで環境変数を読むには
# .envファイルに書き出すしか無いので、nextの外で.envを作成してからnext本体を起動する
# refs https://zenn.dev/cumet04/scraps/f1ee61d0e83161

vars=$(cat <<EOS
PROJECT_ID
AUTH_PATH
SWITCHBOT_TOKEN
SWITCHBOT_SECRET
EOS
)

for var in $vars; do
  if [ ! -v $var ]; then
    echo "envvar $var is not set"
    exit 1
  fi
  echo "$var=${!var}" >> .env
done

exec node server.js
