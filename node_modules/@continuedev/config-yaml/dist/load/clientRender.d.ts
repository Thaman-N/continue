import { z } from "zod";
import { PlatformClient, SecretStore } from "../interfaces/index.js";
import { SecretLocation } from "../interfaces/SecretResult.js";
import { PackageIdentifier } from "../interfaces/slugs.js";
import { AssistantUnrolled } from "../schemas/index.js";
export declare function renderSecrets(packageIdentifier: PackageIdentifier, unrolledConfigContent: string, clientSecretStore: SecretStore, orgScopeId: string | null, // The "scope" that the user is logged in with
onPremProxyUrl: string | null, platformClient?: PlatformClient): Promise<AssistantUnrolled>;
export declare function getUnrenderedSecretLocation(value: string | undefined): SecretLocation | undefined;
export declare function packageIdentifierToShorthandSlug(id: PackageIdentifier): string;
export declare function useProxyForUnrenderedSecrets(config: AssistantUnrolled, packageIdentifier: PackageIdentifier, orgScopeId: string | null, onPremProxyUrl: string | null): AssistantUnrolled;
/** The additional properties that are added to the otherwise OpenAI-compatible body when requesting a Continue proxy */
export declare const continuePropertiesSchema: z.ZodObject<{
    apiKeyLocation: z.ZodOptional<z.ZodString>;
    envSecretLocations: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    apiBase: z.ZodOptional<z.ZodString>;
    orgScopeId: z.ZodNullable<z.ZodString>;
    env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    orgScopeId: string | null;
    apiKeyLocation?: string | undefined;
    envSecretLocations?: Record<string, string> | undefined;
    apiBase?: string | undefined;
    env?: Record<string, any> | undefined;
}, {
    orgScopeId: string | null;
    apiKeyLocation?: string | undefined;
    envSecretLocations?: Record<string, string> | undefined;
    apiBase?: string | undefined;
    env?: Record<string, any> | undefined;
}>;
export type ContinueProperties = z.infer<typeof continuePropertiesSchema>;
