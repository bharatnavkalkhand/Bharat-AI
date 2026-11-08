# Bharat AI — Claude Code Project Guide

## Project identity
- Canonical repository: `bharatnavkalkhand/Bharat-AI`.
- Do not switch to the legacy `bharat-ai-kalkhand` repository.
- Keep changes focused on the existing project. Do not create a duplicate app or repository.
- Prefer free/local/open-source approaches. Never add paid GPU, API, or hosted-provider dependencies without explicit approval.
- Never place API keys, tokens, passwords, or private URLs in source control. Use environment variables and server-side secret storage.

## Required workflow for Claude Code
1. At the beginning of every substantive task, invoke the Task Observer skill (`/task-observer:task-observer`, or the installed skill's equivalent) before planning or using tools.
2. Use Claude-Mem to retrieve relevant prior observations and decisions before changing code; allow it to capture the session after work. Do not store credentials or personal/sensitive data in observations.
3. Inspect the current source, git status, active branch and recent commits before editing. Make small, reviewable changes.
4. Run the relevant tests, type checks and build. Report exact commands and results; never claim a test passed if it was not run.
5. If a command, build, test, dependency, or deployment fails, preserve the exact error, diagnose it, try a safe fix, and document the outcome. Do not loop on the same failed fix.
6. Before finishing, summarize changed files, commit/PR state, test results, remaining blockers, and any manual action required from the user.
7. Do not deploy production or spend money without explicit user approval.

## Local tool setup
Run these commands from the repository root in a terminal where Claude Code is installed:

```bash
# Persistent memory across Claude Code sessions
npx claude-mem install

# Task Observer skill for this project
npx -y skills add rebelytics/one-skill-to-rule-them-all --skill task-observer --agent claude-code
```

Then restart Claude Code. In a Claude Code session, verify Task Observer is available and invoke it. For Claude-Mem, run:

```bash
npx claude-mem doctor
```

Do not use `npm install -g claude-mem` as a substitute: it installs the SDK/library, not the complete Claude Code hooks and worker.

If the Task Observer skill is installed but does not activate automatically, add its session-start activation instruction from the skill's official `references/environments.md` to the local/project Claude instructions and verify it is actually invoked. Review any third-party skill code before trusting it.

## Failure handling / AppDeploy fallback
If Claude Code setup, dependencies, tests, or deployment are blocked:
- Capture the full error message and the exact failing command (redact secrets).
- Use the existing Bharat AI AppDeploy workspace as a diagnostic/deployment fallback; do not create a duplicate project.
- AppDeploy workspace: https://bharat-ai-kalkhand-studio-x4rf1p.v2.appdeploy.ai/
- AppDeploy can inspect and repair its own deployed app/source snapshot. It does not install software on the user's computer or replace local Claude Code installation.
- Keep the GitHub repository as the canonical source unless the user explicitly changes that decision.

## Scope and honesty
Claude Code, Claude-Mem, and Task Observer are developer workflow tools. They do not themselves provide GPU capacity or render AI video. Do not claim any of them is installed locally until the local verification commands succeed.

---

## CURRENT PRIORITY TASK (2026-11-08) — Free AI Video Generator (no credits / no tokens)

**Goal:** Turn Bharat AI into a practical AI video generator that works without any paid credits, API tokens, or paid GPU. Use only free/open-source paths. Stay on the canonical repo.

**Use replica / open-source approach:**
- Base everything on the existing free path already in the repo (HF ZeroGPU Wan 2.1 worker in `workers/hf-zerogpu/`, client adapter in `src/agents/hf-zerogpu-worker.ts`, Video Agent routing in `src/agents/video-agent.ts`).
- Replicate the public product patterns of free AI video tools (text-to-video, image-to-video, short clip generation) using open models and HF Spaces. Do **not** reverse-engineer proprietary commercial tools (Flixier, Runway, Kling, etc.).
- Prefer the replica of the free HF ZeroGPU pattern already scaffolded. Extend it rather than starting a new app.

**Concrete next steps for Claude Code:**
1. Read `FREE_VIDEO_PATH.md`, `README.md`, `workers/hf-zerogpu/`, and `src/agents/video-agent.ts` + `hf-zerogpu-worker.ts` first.
2. Improve the free path so a user can:
   - Generate a short silent AI video clip from a scene prompt with zero keys (HF ZeroGPU Space).
   - Optionally do image-to-video if the worker supports it (extend the Gradio adapter cleanly).
   - Keep the honest storyboard fallback when no worker URL is set or quota is exhausted.
3. Add multi-scene support where practical: generate one clip per scene (or a short sequence) within free quota limits, then assemble a preview in the client scene player. Do not promise unlimited length.
4. Keep all generation client-side or via public free Spaces. No new paid dependencies.
5. Update docs (`FREE_VIDEO_PATH.md`, README) with exact steps and honest limits (HF free ZeroGPU ~5 min/day, short clips only).
6. Ensure `npm run build` / typecheck still pass. Make small, reviewable commits.

**Hard constraints (non-negotiable):**
- ₹0 operating cost for the free path.
- No API keys required for the primary free video path.
- No reverse engineering of proprietary video tools.
- Canonical repo only: `bharatnavkalkhand/Bharat-AI`.
- Honest messaging: never claim unlimited free photoreal movies.

When this task is done, summarize changed files, remaining limits, and the exact steps a user must take to deploy their own free HF Space.
