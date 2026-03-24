import { describe, expect, it } from "vitest";
import { PROTOCOL_VERSION, VERSION } from "./index.js";

describe("index", () => {
  it("exports VERSION", () => {
    expect(VERSION).toBe("0.1.0");
  });

  it("exports PROTOCOL_VERSION", () => {
    expect(PROTOCOL_VERSION).toBe(3);
  });
});
