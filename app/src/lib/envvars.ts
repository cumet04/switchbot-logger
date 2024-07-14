// MEMO: 起動時に環境変数の存在確認を行っていない。
// standaloneモードでinstrumentationが動くようになったら or ヘルスチェックエンドポイントを作ったら、
// そこらあたりで存在確認をするようにしたい
// refs https://github.com/vercel/next.js/issues/49897

const keys = [
  "PROJECT_ID",
  "AUTH_PATH",
  "BASIC_USER",
  "BASIC_PASS",
  "SWITCHBOT_TOKEN",
  "SWITCHBOT_SECRET",
] as const;

export function env(key: (typeof keys)[number]): string {
  if (process.env.NODE_ENV === "test") return `${key}.test`;

  const v = process.env[key];
  if (v === undefined) throw new Error("envvar not found: " + key);
  return v;
}

export type AppEnv = "production" | "staging" | "local";

export function appenv(): AppEnv {
  const v = process.env.NEXT_PUBLIC_APP_ENV;
  switch (v) {
    case "production":
    case "staging":
    case "local":
      return v;
    case undefined:
      return "local";
  }
  // 環境変数が指定されているが想定外の値の場合はエラー
  throw new Error("unexpected APP_ENV: " + v);
}
