import { describe, expect, it, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { loadConfig, ConfigError } from "../src/config.js";
import { RunStore, SEED_RUNS } from "../src/runs.js";

function buildApp() {
  const config = loadConfig({ PORT: "0" });
  const store = new RunStore(SEED_RUNS);
  return createApp({ config, store });
}

describe("config", () => {
  it("uses defaults", () => {
    const cfg = loadConfig({});
    expect(cfg).toMatchObject({ port: 3000, region: "eu", logLevel: "info", metricsEnabled: false });
  });

  it("requires METRICS_PORT when metrics are enabled", () => {
    expect(() => loadConfig({ METRICS_ENABLED: "true" })).toThrow(ConfigError);
    expect(loadConfig({ METRICS_ENABLED: "true", METRICS_PORT: "9100" }).metricsPort).toBe(9100);
  });

  it("rejects unknown log levels", () => {
    expect(() => loadConfig({ LOG_LEVEL: "loud" })).toThrow(/LOG_LEVEL/);
  });
});

describe("runs api", () => {
  let app: ReturnType<typeof buildApp>;
  beforeEach(() => {
    app = buildApp();
  });

  it("reports health", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok", region: "eu" });
  });

  it("lists seeded runs and filters by vehicle", async () => {
    const all = await request(app).get("/api/runs");
    expect(all.body).toHaveLength(SEED_RUNS.length);
    const one = await request(app).get("/api/runs?vehicleId=WVW-1001");
    expect(one.body).toHaveLength(2);
  });

  it("returns 404 for unknown run", async () => {
    const res = await request(app).get("/api/runs/run-9999");
    expect(res.status).toBe(404);
  });

  it("deletes an existing run and returns the deleted record", async () => {
    const created = await request(app)
      .post("/api/runs")
      .send({ vehicleId: "WVW-7777", cycle: "WLTC", co2GramsPerKm: 88.1 });

    const res = await request(app).delete(`/api/runs/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: created.body.id, vehicleId: "WVW-7777" });

    const check = await request(app).get(`/api/runs/${created.body.id}`);
    expect(check.status).toBe(404);
  });

  it("returns 404 when deleting an unknown run", async () => {
    const res = await request(app).delete("/api/runs/run-9999");
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: "run not found", id: "run-9999" });
  });

  it("creates a run", async () => {
    const res = await request(app)
      .post("/api/runs")
      .send({ vehicleId: "WVW-7777", cycle: "WLTC", co2GramsPerKm: 88.1 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ vehicleId: "WVW-7777", status: "planned" });
    expect(res.body.id).toMatch(/^run-\d{4}$/);
  });

  it("rejects invalid input with details", async () => {
    const res = await request(app).post("/api/runs").send({ vehicleId: "", cycle: "FOO", co2GramsPerKm: "x" });
    expect(res.status).toBe(400);
    expect(res.body.details).toHaveLength(3);
  });

  it("rejects CO2 values outside the allowed range", async () => {
    const below = await request(app)
      .post("/api/runs")
      .send({ vehicleId: "WVW-9000", cycle: "WLTC", co2GramsPerKm: -1 });
    const above = await request(app)
      .post("/api/runs")
      .send({ vehicleId: "WVW-9001", cycle: "WLTC", co2GramsPerKm: 501 });

    expect(below.status).toBe(400);
    expect(above.status).toBe(400);
    expect(below.body.details).toContain("co2GramsPerKm must be a number between 0 and 500");
    expect(above.body.details).toContain("co2GramsPerKm must be a number between 0 and 500");
  });

  it("accepts boundary CO2 values", async () => {
    const min = await request(app)
      .post("/api/runs")
      .send({ vehicleId: "WVW-9002", cycle: "WLTC", co2GramsPerKm: 0 });
    const max = await request(app)
      .post("/api/runs")
      .send({ vehicleId: "WVW-9003", cycle: "WLTC", co2GramsPerKm: 500 });

    expect(min.status).toBe(201);
    expect(max.status).toBe(201);
  });
});
