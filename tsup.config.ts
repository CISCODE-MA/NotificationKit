import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: "es2022",
  outDir: "dist",
  tsconfig: "tsconfig.build.json",
  external: [
    "@nestjs/common",
    "nodemailer",
    "twilio",
    "@aws-sdk/client-sns",
    "@vonage/server-sdk",
    "firebase-admin",
    "mongoose",
    "handlebars",
    "nanoid",
    "zod",
  ],
});
