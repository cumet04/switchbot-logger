const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
};

module.exports = withSentryConfig(
  nextConfig,
  {
    silent: true, // Suppresses source map uploading logs during build
    org: "inomoto",
    project: "switchbot-logger",
  },
  {
    hideSourceMaps: true,
    disableLogger: true, // Automatically tree-shake Sentry logger statements to reduce bundle size
  }
);
