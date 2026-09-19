import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildAllGoldenFixtures } from "@/lib/mathDetective/golden";

const EXPECTED_FIXTURE_HASHES: Record<string, string> = {
  "D1-full": "463be044a91470e731836692d42c5a6627bcff3898729de735f587fe4273e5f1",
  "D2-full": "039d9e8232c656a42224c63121da165e966b6aa4716126a494bc26bb3bb1c597",
  "D3-full": "27dd118b40c9946cafe9e8d12b443887181d18e2b65211e882b2b2a37ad01715",
  "D4-full": "0ceff9e237a6a5ac1dc76c3542c1f8254ff62699760939e41cfcba3cde93fdfd",
  "D5-full": "aa0a271ef2d59b3d3b6e10105995a682a364c11caf3b49e23e9ba29d4427325b",
  "D3-mini": "55680cbfd21034831c732ed53e996e5933009e3424321d5836ae00befc8930d3",
};

describe("historical Math Detective parity fixture material", () => {
  it("matches the recorded D1-D5 and mini baseline hashes", () => {
    for (const fixture of buildAllGoldenFixtures()) {
      const hash = createHash("sha256")
        .update(JSON.stringify(fixture))
        .digest("hex");
      expect(hash, fixture.spec.id).toBe(EXPECTED_FIXTURE_HASHES[fixture.spec.id]);
    }
  });
});
