import test from "node:test";
import assert from "node:assert/strict";
import { createAiSharedLayer } from "../src/ai/shared-core.ts";
class MemoryStorage { data = new Map(); getItem(k) { return this.data.get(k) ?? null; } setItem(k, v) { this.data.set(k, v); } }
const role = { id: "image.generate", label: "Image generation", capability: "image-generation", inputs: [{ id: "prompt", required: true }] };
const connection = { id: "local-comfy", label: "Local ComfyUI", provider: "comfyui", adapterId: "test-adapter" };
const model = { id: "sdxl-local", connectionId: "local-comfy", label: "SDXL local", capabilities: ["image-generation"], inputs: [{ id: "prompt", required: true }], enabled: true };
test("compatible binding executes only after consent", async () => {
  let calls = 0;
  const core = createAiSharedLayer({ appId: "studio", storage: new MemoryStorage(), adapters: [{ id: "test-adapter", async execute({ input }) { calls++; return { output: { prompt: input.prompt, artifact: "verified-test.png" } }; } }] });
  core.registerTool(role); core.upsertConnection(connection); core.upsertModel(model);
  assert.equal(core.choices(role.id).length, 1); core.choose(role.id, connection.id, model.id);
  assert.equal(core.status(role.id).available, true);
  await assert.rejects(() => core.start({ roleId: role.id, input: { prompt: "x" }, consent: { granted: false, purpose: "test" } }), { code: "CONSENT_REQUIRED" });
  const job = await core.start({ roleId: role.id, input: { prompt: "cinematic test" }, consent: { granted: true, purpose: "Generate a test image" } });
  assert.equal(job.state, "succeeded"); assert.equal(job.output.artifact, "verified-test.png"); assert.equal(calls, 1);
});
test("incompatible models and missing adapters fail explicitly", () => {
  const core = createAiSharedLayer({ storage: new MemoryStorage() }); core.registerTool(role); core.upsertConnection(connection);
  core.upsertModel({ ...model, capabilities: ["text-generation"] });
  assert.throws(() => core.choose(role.id, connection.id, model.id), { code: "INCOMPATIBLE_MODEL" });
  core.upsertModel(model); core.choose(role.id, connection.id, model.id);
  assert.equal(core.status(role.id).available, false); assert.match(core.status(role.id).reason, /No execution adapter/);
});
test("per-app binding overrides suite default", () => {
  const core = createAiSharedLayer({ appId: "studio", storage: new MemoryStorage(), adapters: [{ id: "test-adapter", async execute() { return { output: null }; } }] });
  core.registerTool(role); core.upsertConnection(connection); core.upsertModel(model); core.choose(role.id, connection.id, model.id);
  core.upsertConnection({ id: "other", label: "Other", provider: "local", adapterId: "test-adapter" });
  core.upsertModel({ ...model, id: "other-model", connectionId: "other" }); core.bind(role.id, "other", "other-model", "second-app");
  assert.equal(core.status(role.id, "studio").binding.modelId, "sdxl-local");
  assert.equal(core.status(role.id, "second-app").binding.modelId, "other-model");
});
test("v1 state migrates without losing tool declarations", () => {
  const storage = new MemoryStorage(); storage.setItem("bharat-ai.shared-ai-core", JSON.stringify({ version: 1, tools: [role], connections: [], models: [], suiteBindings: {} }));
  const core = createAiSharedLayer({ storage }); assert.equal(core.snapshot().version, 2);
  assert.deepEqual(core.snapshot().appBindings, {}); assert.equal(core.customTools()[0].id, role.id);
});
