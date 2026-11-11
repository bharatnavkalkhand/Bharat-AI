# Bharat AI shared AI core

TypeScript-native adoption of the selected Craft AI core concepts; this is not a Rust crate port.

- Versioned shared declarations for tools, connections, models, suite defaults, per-app overrides and jobs.
- Stable tool IDs with capability and required-input contracts; duplicate and built-in mutations are rejected.
- Model compatibility is checked during choice, binding and resolution.
- An explicit adapter registry is required to execute. A declaration or binding is not proof of executable provider support; missing adapters fail explicitly without silent fallback.
- Consent is mandatory before execution; jobs track queued/running/succeeded/failed/cancelled states and support cancellation.
- Version-1 state migrates with empty custom-tool/app-binding collections.
- Shared settings store only opaque credentialRef pointers, never secret values.

## Ownership and storage

Bharat AI owns UI, prompt construction, input conversion and provider-specific workers. The core owns declarations, compatibility, bindings, consent and job contracts. Existing ComfyUI workers are not silently registered as compatible adapters; a provider-specific adapter must explicitly bridge their request/result contract.

The default store is browser localStorage. It is shared among components on the same browser origin, not across devices, profiles or server processes. No database is added without an identified sync/coordination need.

This core does not install model weights, provide free GPU, or make paid inference free. It introduces no mandatory paid key or provider.

## API

createAiSharedLayer({ appId, storage, adapters }) exposes registerTool/removeTool/customTools, upsertConnection/upsertModel, choices, choose (suite default), bind (app override), status, plan, start, cancel, job, and adapter registration.

The contract tests use an in-memory store and deterministic fake adapter. They validate orchestration contracts, not live GPU inference.
