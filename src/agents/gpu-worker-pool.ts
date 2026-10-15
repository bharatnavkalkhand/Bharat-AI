/**
 * Quota-aware free GPU worker pool
 *
 * Dispatches shot-based video generation across free backends
 * (HF ZeroGPU, Colab proxy, Kaggle export, custom HTTP workers).
 *
 * Design:
 * - Partition work into shots (not mid-frame migration)
 * - Rank workers by remaining quota vs estimated cost
 * - Reserve headroom before submit; fallback on QuotaUnavailable
 * - Persist job state so interrupted movies resume
 *
 * Zero paid keys in frontend. Workers are HTTP endpoints only.
 */

export interface ShotRequest {
  movieId: string;
  sceneId: string;
  prompt: string;
  aspectRatio: "16:9" | "9:16";
  width: number;
  height: number;
  durationSec: number;
  seed: number;
  referenceImageUrls?: string[];
  audioPrompt?: string;
}

export interface WorkerQuota {
  available: boolean;
  remainingUnits: number | null;
  unit: string;
  resetsAt?: string;
  reason?: string;
}

export type RemoteJobStatus =
  | { status: "queued" | "running"; progress?: number }
  | { status: "succeeded"; videoUrl: string; audioUrl?: string }
  | { status: "failed"; error: string; retryable?: boolean };

export interface GpuWorkerAdapter {
  readonly id: string;
  supports(request: ShotRequest): boolean;
  quota(): Promise<WorkerQuota>;
  estimateUnits(request: ShotRequest): number;
  submit(
    request: ShotRequest,
    idempotencyKey: string,
  ): Promise<{ remoteJobId: string }>;
  status(remoteJobId: string): Promise<RemoteJobStatus>;
}

export interface QuotaReservationStore {
  reserve(input: {
    workerId: string;
    reservationId: string;
    estimatedUnits: number;
    reportedRemainingUnits: number;
    reserveFraction: number;
  }): Promise<boolean>;
  release(reservationId: string): Promise<void>;
  settle(reservationId: string, actualUnits?: number): Promise<void>;
}

export class QuotaUnavailableError extends Error {
  constructor(message = "Provider quota is unavailable or exhausted") {
    super(message);
    this.name = "QuotaUnavailableError";
  }
}

export class NoEligibleWorkerError extends Error {
  constructor() {
    super("No configured worker has enough known quota for this shot.");
    this.name = "NoEligibleWorkerError";
  }
}

export interface WorkerCandidate {
  worker: GpuWorkerAdapter;
  quota: WorkerQuota;
  estimatedUnits: number;
}

/** Rank workers that can finish this shot within remaining quota */
export async function rankWorkersForShot(
  request: ShotRequest,
  workers: GpuWorkerAdapter[],
  reserveFraction = 0.2,
): Promise<WorkerCandidate[]> {
  const checks = await Promise.all(
    workers.map(async (worker): Promise<WorkerCandidate | null> => {
      try {
        if (!worker.supports(request)) return null;

        const [quota, estimatedUnits] = await Promise.all([
          worker.quota(),
          Promise.resolve(worker.estimateUnits(request)),
        ]);

        if (
          !quota.available ||
          quota.remainingUnits === null ||
          !Number.isFinite(quota.remainingUnits) ||
          !Number.isFinite(estimatedUnits) ||
          estimatedUnits <= 0 ||
          estimatedUnits * (1 + reserveFraction) > quota.remainingUnits
        ) {
          return null;
        }

        return { worker, quota, estimatedUnits };
      } catch {
        return null;
      }
    }),
  );

  return checks
    .filter((c): c is WorkerCandidate => c !== null)
    .sort((a, b) => {
      const aShare = a.estimatedUnits / (a.quota.remainingUnits || 1);
      const bShare = b.estimatedUnits / (b.quota.remainingUnits || 1);
      return aShare - bShare || a.worker.id.localeCompare(b.worker.id);
    });
}

/** Submit to first eligible worker; fallback on quota rejection */
export async function submitShotWithFallback(
  request: ShotRequest,
  idempotencyKey: string,
  workers: GpuWorkerAdapter[],
  ledger: QuotaReservationStore,
  reserveFraction = 0.2,
): Promise<{
  workerId: string;
  remoteJobId: string;
  reservationId: string;
}> {
  const candidates = await rankWorkersForShot(
    request,
    workers,
    reserveFraction,
  );

  for (const candidate of candidates) {
    const reservationId = `${candidate.worker.id}:${idempotencyKey}`;
    const reserved = await ledger.reserve({
      workerId: candidate.worker.id,
      reservationId,
      estimatedUnits: candidate.estimatedUnits,
      reportedRemainingUnits: candidate.quota.remainingUnits!,
      reserveFraction,
    });

    if (!reserved) continue;

    try {
      const job = await candidate.worker.submit(request, idempotencyKey);
      return {
        workerId: candidate.worker.id,
        remoteJobId: job.remoteJobId,
        reservationId,
      };
    } catch (error) {
      if (error instanceof QuotaUnavailableError) {
        await ledger.release(reservationId);
        continue;
      }
      // Keep reservation: network blip may mean worker accepted
      throw error;
    }
  }

  throw new NoEligibleWorkerError();
}

/** In-memory ledger (dev / single-tab). Production needs durable store. */
export class MemoryQuotaLedger implements QuotaReservationStore {
  private reserved = new Map<
    string,
    { workerId: string; units: number }
  >();

  async reserve(input: {
    workerId: string;
    reservationId: string;
    estimatedUnits: number;
    reportedRemainingUnits: number;
    reserveFraction: number;
  }): Promise<boolean> {
    if (this.reserved.has(input.reservationId)) return true;
    let used = 0;
    for (const r of this.reserved.values()) {
      if (r.workerId === input.workerId) used += r.units;
    }
    const headroom =
      input.reportedRemainingUnits * (1 - input.reserveFraction) - used;
    if (input.estimatedUnits > headroom) return false;
    this.reserved.set(input.reservationId, {
      workerId: input.workerId,
      units: input.estimatedUnits,
    });
    return true;
  }

  async release(reservationId: string): Promise<void> {
    this.reserved.delete(reservationId);
  }

  async settle(reservationId: string): Promise<void> {
    this.reserved.delete(reservationId);
  }
}

/**
 * Generic HTTP worker adapter
 * Expects worker endpoints:
 *   GET  /quota  → WorkerQuota JSON
 *   POST /submit → { remoteJobId }
 *   GET  /status/:id → RemoteJobStatus
 */
export function createHttpGpuWorker(
  id: string,
  baseUrl: string,
  opts?: {
    unitCostPerSec?: number;
    supportedAspect?: Array<"16:9" | "9:16">;
  },
): GpuWorkerAdapter {
  const base = baseUrl.replace(/\/$/, "");
  const unitCost = opts?.unitCostPerSec ?? 1;
  const aspects = opts?.supportedAspect ?? ["16:9", "9:16"];

  return {
    id,
    supports(req) {
      return aspects.includes(req.aspectRatio);
    },
    async quota() {
      try {
        const res = await fetch(`${base}/quota`);
        if (!res.ok) {
          return {
            available: false,
            remainingUnits: null,
            unit: "seconds",
            reason: `HTTP ${res.status}`,
          };
        }
        return (await res.json()) as WorkerQuota;
      } catch (e) {
        return {
          available: false,
          remainingUnits: null,
          unit: "seconds",
          reason: e instanceof Error ? e.message : "unreachable",
        };
      }
    },
    estimateUnits(req) {
      return Math.max(1, Math.ceil(req.durationSec * unitCost));
    },
    async submit(req, idempotencyKey) {
      const res = await fetch(`${base}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(req),
      });
      if (res.status === 429 || res.status === 503) {
        throw new QuotaUnavailableError(`Worker ${id} quota/busy`);
      }
      if (!res.ok) {
        throw new Error(`Worker ${id} submit failed: ${res.status}`);
      }
      const data = (await res.json()) as { remoteJobId?: string; jobId?: string };
      const remoteJobId = data.remoteJobId || data.jobId;
      if (!remoteJobId) throw new Error(`Worker ${id} missing job id`);
      return { remoteJobId };
    },
    async status(remoteJobId) {
      const res = await fetch(
        `${base}/status/${encodeURIComponent(remoteJobId)}`,
      );
      if (!res.ok) {
        return { status: "failed", error: `HTTP ${res.status}`, retryable: true };
      }
      return (await res.json()) as RemoteJobStatus;
    },
  };
}

/** Poll until terminal state */
export async function waitForJob(
  worker: GpuWorkerAdapter,
  remoteJobId: string,
  opts?: { maxMs?: number; intervalMs?: number },
): Promise<RemoteJobStatus> {
  const maxMs = opts?.maxMs ?? 180_000;
  const intervalMs = opts?.intervalMs ?? 3000;
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const st = await worker.status(remoteJobId);
    if (st.status === "succeeded" || st.status === "failed") return st;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return { status: "failed", error: "timeout", retryable: true };
}

/** Build default worker list from localStorage / env-style URLs */
export function loadWorkersFromUrls(
  urls: Array<{ id: string; url: string }>,
): GpuWorkerAdapter[] {
  return urls
    .filter((u) => u.url.startsWith("http"))
    .map((u) => createHttpGpuWorker(u.id, u.url));
}
