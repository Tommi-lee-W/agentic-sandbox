export type Cycle = "WLTC" | "NEDC" | "RDE";
export type RunStatus = "planned" | "running" | "done";

export interface MeasurementRun {
  id: string;
  vehicleId: string;
  cycle: Cycle;
  co2GramsPerKm: number;
  status: RunStatus;
  createdAt: string;
}

export interface NewRun {
  vehicleId: string;
  cycle: Cycle;
  co2GramsPerKm: number;
}

export interface StatusUpdate {
  status: RunStatus;
}

export class ValidationError extends Error {
  constructor(public readonly details: string[]) {
    super("validation failed");
  }
}

export class InvalidRunTransitionError extends Error {
  constructor(public readonly from: RunStatus, public readonly to: RunStatus) {
    super("invalid transition");
  }
}

const CYCLES: Cycle[] = ["WLTC", "NEDC", "RDE"];
const RUN_STATUSES: RunStatus[] = ["planned", "running", "done"];
const ALLOWED_TRANSITIONS: Record<RunStatus, RunStatus[]> = {
  planned: ["running"],
  running: ["done"],
  done: [],
};

export function validateNewRun(input: unknown): NewRun {
  const details: string[] = [];
  const body = (input ?? {}) as Record<string, unknown>;

  if (typeof body.vehicleId !== "string" || body.vehicleId.trim() === "") {
    details.push("vehicleId must be a non-empty string");
  }
  if (!CYCLES.includes(body.cycle as Cycle)) {
    details.push(`cycle must be one of ${CYCLES.join("|")}`);
  }
  if (typeof body.co2GramsPerKm !== "number" || Number.isNaN(body.co2GramsPerKm)) {
    details.push("co2GramsPerKm must be a number");
  }
  if (details.length > 0) throw new ValidationError(details);

  return {
    vehicleId: (body.vehicleId as string).trim(),
    cycle: body.cycle as Cycle,
    co2GramsPerKm: body.co2GramsPerKm as number,
  };
}

export function validateStatusUpdate(input: unknown): StatusUpdate {
  const details: string[] = [];
  const body = (input ?? {}) as Record<string, unknown>;

  if (typeof body.status !== "string" || !RUN_STATUSES.includes(body.status as RunStatus)) {
    details.push(`status must be one of ${RUN_STATUSES.join("|")}`);
  }
  if (details.length > 0) throw new ValidationError(details);

  return {
    status: body.status as RunStatus,
  };
}

export function canTransition(from: RunStatus, to: RunStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export class RunStore {
  private readonly runs = new Map<string, MeasurementRun>();
  private seq = 0;

  constructor(seed: NewRun[] = []) {
    for (const run of seed) this.create(run);
  }

  list(vehicleId?: string): MeasurementRun[] {
    const all = [...this.runs.values()];
    return vehicleId ? all.filter((r) => r.vehicleId === vehicleId) : all;
  }

  get(id: string): MeasurementRun | undefined {
    return this.runs.get(id);
  }

  create(input: NewRun): MeasurementRun {
    this.seq += 1;
    const run: MeasurementRun = {
      id: `run-${String(this.seq).padStart(4, "0")}`,
      ...input,
      status: "planned",
      createdAt: new Date().toISOString(),
    };
    this.runs.set(run.id, run);
    return run;
  }

  updateStatus(id: string, status: RunStatus): MeasurementRun {
    const run = this.runs.get(id);
    if (!run) throw new Error(`run not found: ${id}`);
    if (!canTransition(run.status, status)) {
      throw new InvalidRunTransitionError(run.status, status);
    }
    run.status = status;
    return run;
  }
}

export const SEED_RUNS: NewRun[] = [
  { vehicleId: "WVW-1001", cycle: "WLTC", co2GramsPerKm: 118.4 },
  { vehicleId: "WVW-1001", cycle: "RDE", co2GramsPerKm: 131.9 },
  { vehicleId: "WVW-2042", cycle: "WLTC", co2GramsPerKm: 97.2 },
  { vehicleId: "WVW-3310", cycle: "NEDC", co2GramsPerKm: 104.0 },
];
