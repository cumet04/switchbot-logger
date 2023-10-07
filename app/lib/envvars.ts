type EnvVars = {
  projectId: string;
  authPath: string;
  switchbotToken: string;
  switchbotSecret: string;
};

const _vars: EnvVars = {
  projectId: mustEnv("PROJECT_ID"),
  authPath: mustEnv("AUTH_PATH"),
  switchbotToken: mustEnv("SWITCHBOT_TOKEN"),
  switchbotSecret: mustEnv("SWITCHBOT_SECRET"),
};
export function env<K extends keyof EnvVars>(key: K): EnvVars[K] {
  return _vars[key];
}

function mustEnv(key: string): string {
  if (process.env.NODE_ENV === "test") return `${key}.test`;

  const v = process.env[key];
  if (v === undefined) throw new Error("envvar not found: " + key);
  return v;
}
