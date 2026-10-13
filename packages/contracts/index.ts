import type { Card } from '../card-format'
export type SavedCard = { id: string; card: Card; importedAt: string }
export type RuntimeStatus = { state: string; installed: boolean; environmentState: 'missing' | 'ready' | 'update-required' | 'repair-required'; running: boolean; cleanupPending: boolean; progress: string; error: string; diagnostic: Record<string, unknown>; logs: string[]; device: { model: string; android: string; sdk: number; abi: string; pageSize: number; availableBytes: number; build: string; webview: string }; version: string; hds: string }
export type ModelProvider = {
  id: string; preset: string; label: string; endpoint: string; model: string; modelsEndpoint?: string;
  protocol: 'chat-completions' | 'anthropic-messages'; enabled: boolean; credentialPresent: boolean;
  useForMain: boolean; useForCompaction: boolean; useForAlter: boolean;
  deepseekThinking?: 'inherit' | 'disabled' | 'enabled'; apiKey?: string; clearKey?: boolean;
}
export type ModelOptions = {
  mainStreamingMode: 'off' | 'experimental'; mainResponseFormat: 'json-object' | 'prompt-only';
  mainTemperature: number; mainMaxTokens: number; mainTimeout: number;
  mainPayloadOrder: 'cache-first' | 'legacy'; failoverEnabled: boolean; failoverStrategy: 'priority' | 'round-robin';
}
export type ModelSettings = { providers: ModelProvider[]; modelOptions: ModelOptions; userName: string; userProfile: string; autoAdvance: boolean }
export type Message = { id: string; direction: 'user' | 'character'; content: string; occurredAt: string; status: string }
export type QQPolicy = { enabled: boolean; users: string[]; groups: string[] }
export type DownloadProgress = { component: string; receivedBytes: number; totalBytes?: number; bytesPerSecond: number }
export type QQStatus = { phase: string; installed: boolean; running: boolean; online: boolean; progress: string; download?: DownloadProgress; error: string; account: string; nickname: string; qr: string; policy: QQPolicy; logs: string[] }
export type QQConversation = { id: string; name: string; last: string; time: number; unread: number }
export type QQMessage = { id: string; conversation: string; sender: string; name: string; content: string; time: number; outgoing: boolean }
export type NativeBridge = {
  status(): Promise<RuntimeStatus>;
  install(): Promise<void>;
  cancelInstall(): Promise<void>;
  diagnostics(options?: { probe?: boolean }): Promise<Record<string, unknown>>;
  copyDiagnostics(): Promise<void>;
  saveDiagnostics(): Promise<{ cancelled: boolean }>;
  saveQQQr(options: { base64: string }): Promise<{ cancelled: boolean }>;
  start(): Promise<void>;
  stop(): Promise<void>;
  settings(): Promise<ModelSettings & { activeCard: string }>;
  saveSettings(options: ModelSettings): Promise<void>;
  pickCard(): Promise<{ base64: string; name: string }>;
  cards(): Promise<{ cards: SavedCard[] }>;
  saveCard(options: { card: Card; base64: string }): Promise<SavedCard>;
  selectCard(options: { id: string }): Promise<void>;
  updateCard(options: { id: string; card: Card }): Promise<SavedCard>;
  deleteCard(options: { id: string }): Promise<void>;
  rpc(options: { method: string; payload?: Record<string, unknown> }): Promise<{ data: unknown }>;
}
