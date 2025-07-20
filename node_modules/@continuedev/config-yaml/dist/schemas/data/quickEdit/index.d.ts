import { z } from "zod";
export declare const quickEditEventAllSchema: z.ZodObject<{
    prompt: z.ZodString;
    path: z.ZodOptional<z.ZodString>;
    label: z.ZodString;
    diffs: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["new", "old", "same"]>;
        line: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "new" | "old" | "same";
        line: string;
    }, {
        type: "new" | "old" | "same";
        line: string;
    }>, "many">>;
    model: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    prompt: string;
    label: string;
    path?: string | undefined;
    model?: string | undefined;
    diffs?: {
        type: "new" | "old" | "same";
        line: string;
    }[] | undefined;
}, {
    prompt: string;
    label: string;
    path?: string | undefined;
    model?: string | undefined;
    diffs?: {
        type: "new" | "old" | "same";
        line: string;
    }[] | undefined;
}>;
