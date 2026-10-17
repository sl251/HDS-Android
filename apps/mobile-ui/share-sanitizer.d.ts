export function sanitizeSharePayload(raw: unknown): { preset: Record<string, unknown>; removed: string[] }
export function fetchShare(ctx: { http: { get(url: string, options?: unknown): Promise<unknown> } }, baseUrl: string, code: string): Promise<{
  info: { code: string; title: string; revision: number; payload: Record<string, unknown> }; removed: string[]
}>
export function storyDefaultsToSettingPatch(raw: unknown): { character?: { name?: string; profile?: string }; user?: { profile?: string }; [field: string]: unknown }
