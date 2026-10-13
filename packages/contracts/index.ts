import type { Card } from '../card-format'
export type SavedCard = { id: string; card: Card; importedAt: string }
export type RuntimeStatus = { state: string; installed: boolean; environmentState: 'missing' | 'ready' | 'update-required' | 'repair-required'; running: boolean; cleanupPending: boolean; progress: string; error: string; diagnostic: Record<string, unknown>; logs: string[]; device: { model: string; android: string; sdk: number; abi: string; pageSize: number; availableBytes: number; build: string; webview: string }; version: string; hds: string }
export type ModelSettings = { endpoint: string; model: string; credentialPresent: boolean; userName: string; userProfile: string; autoAdvance: boolean }
export type Message = { id: string; direction: 'user' | 'character'; content: string; occurredAt: string; status: string }
export type NativeBridge = {
  status(): Promise<RuntimeStatus>;
  install(): Promise<void>;
  cancelInstall(): Promise<void>;
  diagnostics(options?: { probe?: boolean }): Promise<Record<string, unknown>>;
  copyDiagnostics(): Promise<void>;
  saveDiagnostics(): Promise<{ cancelled: boolean }>;
  start(): Promise<void>;
  stop(): Promise<void>;
  settings(): Promise<ModelSettings & { activeCard: string }>;
  saveSettings(options: { endpoint: string; model: string; apiKey: string; clearKey?: boolean; userName: string; userProfile: string; autoAdvance: boolean }): Promise<void>;
  pickCard(): Promise<{ base64: string; name: string }>;
  cards(): Promise<{ cards: SavedCard[] }>;
  saveCard(options: { card: Card; base64: string }): Promise<SavedCard>;
  selectCard(options: { id: string }): Promise<void>;
  rpc(options: { method: string; payload?: Record<string, unknown> }): Promise<{ data: unknown }>;
}
