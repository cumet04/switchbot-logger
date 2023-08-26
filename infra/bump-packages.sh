#!/bin/bash

# cdktf関連のパッケージをアップデートする際に利用するヘルパースクリプト
#
# 実行するとnpmパッケージのフルアップデートを実行するが、その前後にnpm run synthを行い
# アップデート前後でその成果物にどんな差分があるかを表示する。
#
# 通常はjson内に記載されるプロバイダのバージョン差分しか出ないので、その場合は安心してcommitする。
# そうでない差分がある場合は詳細を調査して対応する。
#
# 前後差分表示のために、cdktfが生成するtf.jsonをgit stageに入れているが、差分を見終わったらcommitせずはずしておくこと。

set -eu

cd $(dirname $0)

npm ci

npm run synth
git add -f cdktf.out/stacks/**/cdk.tf.json

# @types/nodeはnodejsのバージョンを上げるときに合わせて上げる
npx npm-check-updates -u --reject @types/node

# 依存する子孫パッケージも含めて完全に最新化するため、現状バージョンの痕跡を消してからnpm installする
rm -rf node_modules package-lock.json
npm install

npm run synth

git add package.json package-lock.json
set +e
git diff
