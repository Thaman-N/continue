import { z } from "zod";
export declare const baseDevDataAllSchema: z.ZodObject<{
    eventName: z.ZodString;
    schema: z.ZodString;
    timestamp: z.ZodString;
    userId: z.ZodString;
    userAgent: z.ZodString;
    selectedProfileId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    eventName: string;
    schema: string;
    timestamp: string;
    userId: string;
    userAgent: string;
    selectedProfileId: string;
}, {
    eventName: string;
    schema: string;
    timestamp: string;
    userId: string;
    userAgent: string;
    selectedProfileId: string;
}>;
