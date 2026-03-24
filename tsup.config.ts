import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts"],
  format: ["esm"],
  dts: true,
  target: "node20",
  clean: true,
  splitting: true,
  sourcemap: true,
});
