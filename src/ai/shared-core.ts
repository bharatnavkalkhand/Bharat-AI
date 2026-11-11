/**
 * Bharat AI's TypeScript adoption of Craft AI core concepts.
 * Browser-local versioned contract store; no provider fallback or secret values.
 */
export type RoleId = string;
export type JobState = "queued" | "running" | "succeeded" | "failed" | "cancelled";
export interface InputRole { id: string; required: boolean }
export interface ToolRole { id: RoleId; label: string; capability: string; inputs: InputRole[]; builtIn?: boolean }
export interface AiConnection { id: string; label: string; provider: string; adapterId: string; credentialRef?: string }
export interface AiModel { id: string; connectionId: string; label: string; capabilities: string[]; inputs: InputRole[]; enabled: boolean }
export interface AiBinding { roleId: string; connectionId: string; modelId: string }
export interface AiJob {
  id: string; roleId: string; connectionId: string; modelId: string; adapterId: string;
  state: JobState; createdAt: string; updatedAt: string;
  consent: { granted: true; grantedAt: string; purpose: string };
  input: Record<string, unknown>; output?: unknown; error?: string; remoteId?: string;
}
export interface SharedAiState {
  version: 2; tools: ToolRole[]; connections: AiConnection[]; models: AiModel[];
  suiteBindings: Record<string, AiBinding>; appBindings: Record<string, Record<string, AiBinding>>; jobs: AiJob[];
}
export interface AiExecutionAdapter {
  id: string;
  execute(context: { jobId: string; role: ToolRole; connection: AiConnection; model: AiModel; input: Record<string, unknown>; signal: AbortSignal }): Promise<{ output: unknown; remoteId?: string }>;
  cancel?(remoteId: string): Promise<void>;
}
export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }
export class AiCoreError extends Error {
  readonly code: string;
  constructor(message: string, code: string) { super(message); this.name = "AiCoreError"; this.code = code; }
}
const KEY = "bharat-ai.shared-ai-core";
const EMPTY: SharedAiState = { version: 2, tools: [], connections: [], models: [], suiteBindings: {}, appBindings: {}, jobs: [] };
const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
function compatible(role: ToolRole, model: AiModel): boolean {
  return model.enabled && model.capabilities.includes(role.capability) &&
    role.inputs.every((input) => !input.required || model.inputs.some((candidate) => candidate.id === input.id));
}
function validateRole(role: ToolRole): void {
  if (!role.id.trim() || !role.label.trim() || !role.capability.trim()) throw new AiCoreError("Tool ID, label and capability are required.", "INVALID_ROLE");
  if (!role.inputs.length || role.inputs.some((input) => !input.id.trim())) throw new AiCoreError("Tool must declare named input roles.", "INVALID_INPUT_CONTRACT");
}
export function createAiSharedLayer(options: { appId?: string; storage?: StorageLike; adapters?: AiExecutionAdapter[] } = {}) {
  const appId = options.appId || "bharat-ai";
  const storage = options.storage ?? (typeof localStorage === "undefined" ? undefined : localStorage);
  const adapters = new Map((options.adapters || []).map((adapter) => [adapter.id, adapter]));
  const controllers = new Map<string, AbortController>();
  function read(): SharedAiState {
    if (!storage) return copy(EMPTY);
    const raw = storage.getItem(KEY);
    if (!raw) return copy(EMPTY);
    let parsed: Partial<SharedAiState>;
    try { parsed = JSON.parse(raw) as Partial<SharedAiState>; }
    catch { throw new AiCoreError("Shared AI store is corrupt; refusing to overwrite it.", "STORE_CORRUPT"); }
    return { ...copy(EMPTY), ...parsed, version: 2,
      tools: parsed.tools || [], connections: parsed.connections || [], models: parsed.models || [],
      suiteBindings: parsed.suiteBindings || {}, appBindings: parsed.appBindings || {}, jobs: parsed.jobs || [] };
  }
  function write(state: SharedAiState): void {
    if (!storage) throw new AiCoreError("Persistent browser storage is unavailable.", "NO_STORAGE");
    storage.setItem(KEY, JSON.stringify({ ...state, version: 2 }));
  }
  function update(fn: (state: SharedAiState) => void): void { const state = read(); fn(state); write(state); }
  function roleOf(state: SharedAiState, id: string): ToolRole {
    const role = state.tools.find((item) => item.id === id);
    if (!role) throw new AiCoreError("Tool declaration not found: " + id, "ROLE_NOT_FOUND");
    return role;
  }
  function resolve(state: SharedAiState, id: string, targetApp: string) {
    const role = state.tools.find((item) => item.id === id);
    if (!role) return { available: false, reason: "Tool declaration not found: " + id };
    const binding = state.appBindings[targetApp]?.[id] || state.suiteBindings[id];
    if (!binding) return { available: false, reason: "No model is bound to this tool.", role };
    const connection = state.connections.find((item) => item.id === binding.connectionId);
    const model = state.models.find((item) => item.id === binding.modelId);
    if (!connection || !model || model.connectionId !== connection.id) return { available: false, reason: "Bound connection or model no longer exists.", role, binding };
    if (!compatible(role, model)) return { available: false, reason: "Bound model violates the tool capability/input contract.", role, binding, model, connection };
    if (!adapters.has(connection.adapterId)) return { available: false, reason: "No execution adapter registered for " + connection.adapterId + ". No fallback will be substituted.", role, binding, model, connection };
    return { available: true, reason: "Compatible model and execution adapter are ready.", role, binding, model, connection };
  }
  function validateInput(role: ToolRole, input: Record<string, unknown>): void {
    for (const field of role.inputs) if (field.required && (input[field.id] === undefined || input[field.id] === null || input[field.id] === "")) {
      throw new AiCoreError("Missing required input: " + field.id, "MISSING_INPUT");
    }
  }
  function plan(request: { roleId: string; input: Record<string, unknown>; appId?: string }) {
    const result = resolve(read(), request.roleId, request.appId || appId);
    if (!result.available) throw new AiCoreError(result.reason, "UNAVAILABLE");
    validateInput(result.role!, request.input);
    return { role: result.role!, connection: result.connection!, model: result.model!, adapterId: result.connection!.adapterId };
  }
  return {
    appId,
    snapshot: () => read(),
    registerAdapter(adapter: AiExecutionAdapter) { adapters.set(adapter.id, adapter); },
    unregisterAdapter(id: string) { adapters.delete(id); },
    registerTool(role: ToolRole) {
      validateRole(role);
      update((state) => {
        const old = state.tools.find((item) => item.id === role.id);
        if (old?.builtIn) throw new AiCoreError("Built-in declarations cannot be replaced.", "BUILTIN_IMMUTABLE");
        if (old) throw new AiCoreError("Tool ID already registered.", "ROLE_EXISTS");
        state.tools.push({ ...copy(role), builtIn: false });
      });
    },
    removeTool(id: string) {
      update((state) => {
        if (roleOf(state, id).builtIn) throw new AiCoreError("Built-in declarations cannot be removed.", "BUILTIN_IMMUTABLE");
        state.tools = state.tools.filter((item) => item.id !== id);
        delete state.suiteBindings[id];
        Object.values(state.appBindings).forEach((bindings) => delete bindings[id]);
      });
    },
    customTools: () => read().tools.filter((role) => !role.builtIn),
    upsertConnection(connection: AiConnection) {
      if (!connection.id || !connection.provider || !connection.adapterId) throw new AiCoreError("Connection ID, provider and adapter are required.", "INVALID_CONNECTION");
      update((state) => { const i = state.connections.findIndex((item) => item.id === connection.id); if (i < 0) state.connections.push(copy(connection)); else state.connections[i] = copy(connection); });
    },
    upsertModel(model: AiModel) {
      update((state) => {
        if (!state.connections.some((item) => item.id === model.connectionId)) throw new AiCoreError("Model connection does not exist.", "CONNECTION_NOT_FOUND");
        const i = state.models.findIndex((item) => item.id === model.id); if (i < 0) state.models.push(copy(model)); else state.models[i] = copy(model);
      });
    },
    choices(id: string) {
      const state = read(); const role = roleOf(state, id);
      return state.models.filter((model) => compatible(role, model)).map((model) => {
        const connection = state.connections.find((item) => item.id === model.connectionId)!;
        return { model, connection, adapterAvailable: adapters.has(connection.adapterId) };
      });
    },
    choose(id: string, connectionId: string, modelId: string) {
      update((state) => {
        const role = roleOf(state, id); const connection = state.connections.find((item) => item.id === connectionId);
        const model = state.models.find((item) => item.id === modelId);
        if (!connection || !model || model.connectionId !== connectionId) throw new AiCoreError("Connection/model mismatch.", "BINDING_MISMATCH");
        if (!compatible(role, model)) throw new AiCoreError("Model does not meet declared capability and inputs.", "INCOMPATIBLE_MODEL");
        state.suiteBindings[id] = { roleId: id, connectionId, modelId };
      });
    },
    bind(id: string, connectionId: string, modelId: string, targetApp = appId) {
      update((state) => {
        const role = roleOf(state, id); const connection = state.connections.find((item) => item.id === connectionId);
        const model = state.models.find((item) => item.id === modelId);
        if (!connection || !model || model.connectionId !== connectionId) throw new AiCoreError("Connection/model mismatch.", "BINDING_MISMATCH");
        if (!compatible(role, model)) throw new AiCoreError("Model does not meet declared capability and inputs.", "INCOMPATIBLE_MODEL");
        state.appBindings[targetApp] ||= {}; state.appBindings[targetApp][id] = { roleId: id, connectionId, modelId };
      });
    },
    status(id: string, targetApp = appId) { return resolve(read(), id, targetApp); },
    plan,
    async start(request: { roleId: string; input: Record<string, unknown>; consent: { granted: boolean; purpose: string }; appId?: string }): Promise<AiJob> {
      if (!request.consent?.granted) throw new AiCoreError("User consent is required before execution.", "CONSENT_REQUIRED");
      if (!request.consent.purpose.trim()) throw new AiCoreError("Consent purpose is required.", "CONSENT_PURPOSE_REQUIRED");
      const selected = plan(request); const now = new Date().toISOString();
      const id = globalThis.crypto?.randomUUID?.() || ("job-" + Date.now() + "-" + Math.random().toString(36).slice(2));
      const job: AiJob = { id, roleId: request.roleId, connectionId: selected.connection.id, modelId: selected.model.id,
        adapterId: selected.adapterId, state: "queued", createdAt: now, updatedAt: now,
        consent: { granted: true, grantedAt: now, purpose: request.consent.purpose }, input: copy(request.input) };
      update((state) => { state.jobs.push(job); });
      const controller = new AbortController(); controllers.set(id, controller);
      update((state) => { const item = state.jobs.find((entry) => entry.id === id)!; item.state = "running"; item.updatedAt = new Date().toISOString(); });
      try {
        const result = await adapters.get(selected.adapterId)!.execute({ jobId: id, role: selected.role, connection: selected.connection, model: selected.model, input: copy(request.input), signal: controller.signal });
        update((state) => { const item = state.jobs.find((entry) => entry.id === id)!; item.state = controller.signal.aborted ? "cancelled" : "succeeded"; item.output = result.output; item.remoteId = result.remoteId; item.updatedAt = new Date().toISOString(); });
      } catch (error) {
        update((state) => { const item = state.jobs.find((entry) => entry.id === id)!; item.state = controller.signal.aborted ? "cancelled" : "failed"; item.error = error instanceof Error ? error.message : "Adapter execution failed."; item.updatedAt = new Date().toISOString(); });
      } finally { controllers.delete(id); }
      return read().jobs.find((item) => item.id === id)!;
    },
    async cancel(id: string) {
      const job = read().jobs.find((item) => item.id === id);
      if (!job || ["succeeded", "failed", "cancelled"].includes(job.state)) return false;
      controllers.get(id)?.abort();
      if (job.remoteId) await adapters.get(job.adapterId)?.cancel?.(job.remoteId);
      update((state) => { const item = state.jobs.find((entry) => entry.id === id); if (item && !["succeeded", "failed"].includes(item.state)) { item.state = "cancelled"; item.updatedAt = new Date().toISOString(); } });
      return true;
    },
    job(id: string) { return read().jobs.find((item) => item.id === id); },
  };
}
