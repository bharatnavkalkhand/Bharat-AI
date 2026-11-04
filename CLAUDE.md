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
