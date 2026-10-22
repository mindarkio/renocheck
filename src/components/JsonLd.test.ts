import { describe, expect, it } from "vitest";
import { serializeJsonLd } from "@/components/JsonLd";

describe("serializeJsonLd", () => {
  it("escapes characters that could end the script element", () => {
    const data = { name: "a</script><b>c", note: "x\u2028y\u2029z" };
    const out = serializeJsonLd(data);
    expect(out).not.toContain("<");
    expect(out).not.toContain("\u2028");
    expect(out).not.toContain("\u2029");
    expect(JSON.parse(out)).toEqual(data);
  });
});
