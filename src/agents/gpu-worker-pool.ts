export interface ShotRequest {
  movieId: string;
  sceneId: string;
  prompt: string;
  aspectRatio: "16:9";
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
    .filter((candidate): candidate is WorkerCandidate => candidate !== null)
    .sort((a, b) => {
      const aShare = a.estimatedUnits / (a.quota.remainingUnits || 1);
      const bShare = b.estimatedUnits / (b.quota.remainingUnits || 1);
      return aShare - bShare || a.worker.id.localeCompare(b.worker.id);
    });
}

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

      // Keep the reservation: a network failure may mean the worker accepted the job.
      throw error;
    }
  }

  throw new NoEligibleWorkerError();
}