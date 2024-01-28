// MEMO: 起動時に環境変数の存在確認を行っていない。
// standaloneモードでinstrumentationが動くようになったら or ヘルスチェックエンドポイントを作ったら、
// そこらあたりで存在確認をするようにしたい
// refs https://github.com/vercel/next.js/issues/49897

const keys = [
  "PROJECT_ID",
  "AUTH_PATH",
  "SWITCHBOT_TOKEN",
  "SWITCHBOT_SECRET",
] as const;

export function env(key: (typeof keys)[number]): string {
  if (process.env.NODE_ENV === "test") return `${key}.test`;

  const v = process.env[key];
  if (v === undefined) throw new Error("envvar not found: " + key);
  return v;
}
