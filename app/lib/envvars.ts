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
