#!/bin/bash

# cdktf関連のパッケージをアップデートする際に利用するヘルパースクリプト

set -eu

cd $(dirname $0)

# @types/nodeはnodejsのバージョンを上げるときに合わせて上げる
# typescriptはgtsの依存の@typescript-eslint/typescript-estreeのバージョンの対応を見ながら上げる
npx npm-check-updates -u --reject @types/node --reject typescript

# 依存する子孫パッケージも含めて完全に最新化するため、現状バージョンの痕跡を消してからnpm installする
rm -rf node_modules package-lock.json
npm install

# synthや型でエラーにならないか程度は確認しておく
npm run lint
npm run fix
npm run typecheck
npm run synth
