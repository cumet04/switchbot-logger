import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  dir: "./",
});

/** @type {import('jest').Config} */
const config = {
  testEnvironment: "./FixJSDOMEnvironment.ts",
};

export default createJestConfig(config);
