export declare const quickEditEventSchema_0_1_0: import("zod").ZodObject<Pick<{
    prompt: import("zod").ZodString;
    path: import("zod").ZodOptional<import("zod").ZodString>;
    label: import("zod").ZodString;
    diffs: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodObject<{
        type: import("zod").ZodEnum<["new", "old", "same"]>;
        line: import("zod").ZodString;
    }, "strip", import("zod").ZodTypeAny, {
        type: "new" | "old" | "same";
        line: string;
    }, {
        type: "new" | "old" | "same";
        line: string;
    }>, "many">>;
    model: import("zod").ZodOptional<import("zod").ZodString>;
}, "path" | "model" | "prompt" | "label" | "diffs">, "strip", import("zod").ZodTypeAny, {
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
export declare const quickEditEventSchema_0_1_0_noCode: import("zod").ZodObject<Omit<Pick<{
    prompt: import("zod").ZodString;
    path: import("zod").ZodOptional<import("zod").ZodString>;
    label: import("zod").ZodString;
    diffs: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodObject<{
        type: import("zod").ZodEnum<["new", "old", "same"]>;
        line: import("zod").ZodString;
    }, "strip", import("zod").ZodTypeAny, {
        type: "new" | "old" | "same";
        line: string;
    }, {
        type: "new" | "old" | "same";
        line: string;
    }>, "many">>;
    model: import("zod").ZodOptional<import("zod").ZodString>;
}, "path" | "model" | "prompt" | "label" | "diffs">, "path" | "prompt" | "diffs">, "strip", import("zod").ZodTypeAny, {
    label: string;
    model?: string | undefined;
}, {
    label: string;
    model?: string | undefined;
}>;
