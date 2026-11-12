# Bharat-AI 30-Day Roadmap
Repo: https://github.com/bharatnavkalkhand/Bharat-AI

## Goal
Turn the current prototype into a reliable short-form AI video pipeline with honest output states, durable job tracking, and a working real render flow.

## Reality check
This repo is already a strong MVP/prototype, but it still depends on external workers, quotas, and real infrastructure. The most important completion work is not “add more UI”; it is “make generation reliable, resumable, and honest.”

---

## Week 1: Foundation and production contract
Focus:
- define the real supported backend
- define worker API contract
- define job lifecycle contract
- plan the architecture with production honesty

Tasks:
- Choose 1 primary supported worker backend
  - recommended: a deployed HF ZeroGPU Space or self-hosted ComfyUI worker
- Write a single backend contract for all workers:
  - submit
  - poll
  - status
  - videoUrl
  - error
  - retryable
- Create job model:
  - movieId
  - sceneId
  - workerId
  - remoteJobId
  - status
  - startedAt
  - updatedAt
  - retryCount
  - outputUrl
  - errorMessage
- Define “storyboard-only” vs “real generated” states
- Define “render ready” logic

Deliverables:
- one supported pipeline path
- clean API contract
- durable job schema
- honest status definitions

---

## Week 2: Durable job flow and queueing
Focus:
- stop relying on browser memory
- add persistent render state
- create retry/resume model

Tasks:
- Implement server-side job API
  - POST /jobs
  - GET /jobs/:id
  - POST /jobs/:id/retry
  - POST /jobs/:id/status
- Persist jobs in a database or durable storage
- Add idempotency keys per scene
- Add retry logic for safe failures
- Add queue states:
  - queued
  - running
  - succeeded
  - failed
  - timeout
  - skipped
- Add explicit per-scene completion tracking

Deliverables:
- working render lifecycle
- resume-after-refresh support
- reduced duplicate generation
- clear scene-by-scene status

---

## Week 3: Real worker validation
Focus:
- choose one backend and make it work end-to-end
- validate real generation, not just UI flow

Tasks:
- Deploy or run the chosen worker backend
- Test:
  - submit prompt
  - receive job ID
  - poll until completion
  - extract final MP4 URL
  - verify file is actually returned
- Handle:
  - quota exhausted
  - busy worker
  - cold start
  - timeout
  - malformed output
- Add error mapping:
  - quota
  - network
  - worker failure
  - invalid output
  - timeout

Deliverables:
- one validated real generation path
- output extraction logic confirmed
- honest error handling

---

## Week 4: Final assembly and export
Focus:
- build finishing pipeline
- ensure final render is real before marking complete

Tasks:
- Add render assembly stage:
  - order scenes
  - combine generated clips
  - add narration/audio if available
  - join scenes into final MP4
- Add manifest:
  - generated clips
  - storyboard-only scenes
  - audio status
  - worker used
  - timestamps
  - duration
- Add “render ready” gate:
  - only enable if actual output exists
- Add per-scene provenance labels:
  - AI-generated
  - locally assembled
  - storyboard-only

Deliverables:
- final short-form movie export
- explicit provenance tracking
- honest final render state

---

## Final 30-day success criteria
By day 30, the repo should support:
- a short movie project flow
- one real generation backend
- queue and retry logic
- durable job tracking
- honest completion states
- a final MP4 export based on actual generated clips
- visible distinction between real output and storyboard-only output

---

## Priority order for implementation
If time is limited, do these in order:

1. Durable job lifecycle
2. Single supported worker validation
3. Final render assembly/export
4. Honest queue and quota messaging
5. UX polish and status clarity

---

## Recommended output for this repo
The best achievable MVP is:
- short movies only
- 3 to 5 scenes
- 1 real worker backend
- visible quota warnings
- explicit partial completion states
- final MP4 assembly from real assets

This is the honest production target for this repo.

---

## Suggested GitHub issue set for the 30-day roadmap
- Add durable job lifecycle
- Choose and validate a primary worker backend
- Normalize worker API responses
- Add queue, retry, and timeout logic
- Build final assembly and export pipeline
- Add honest render status and final completion checks
- Add quota-aware message handling
- Add render manifest and provenance labeling

---

## Minimal completion target by day 30
A user should be able to:
- create a short project
- generate one real clip from a working worker
- see scene status
- resume failed work
- assemble final export
- understand which parts are real and which are storyboard-only
