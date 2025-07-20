import { SecretType, decodeSecretLocation, encodeSecretLocation, } from "./SecretResult.js";
describe("SecretLocation encoding/decoding", () => {
    it("encodes/decodes organization secret location", () => {
        const orgSecretLocation = {
            secretType: SecretType.Organization,
            orgSlug: "test-org",
            secretName: "secret1",
        };
        const encoded = encodeSecretLocation(orgSecretLocation);
        expect(encoded).toBe("organization:test-org/secret1");
        const decoded = decodeSecretLocation(encoded);
        expect(decoded).toEqual(orgSecretLocation);
    });
    it("encodes/decodes package secret location", () => {
        const packageSlug = {
            ownerSlug: "test-org",
            packageSlug: "test-package",
        };
        const packageSecretLocation = {
            secretType: SecretType.Package,
            packageSlug,
            secretName: "secret1",
        };
        const encoded = encodeSecretLocation(packageSecretLocation);
        expect(encoded).toBe("package:test-org/test-package/secret1");
        const decoded = decodeSecretLocation(encoded);
        expect(decoded).toEqual(packageSecretLocation);
    });
});
//# sourceMappingURL=SecretResult.test.js.map