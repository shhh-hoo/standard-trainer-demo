import { link, mkdir, open, readFile, readdir, unlink } from "node:fs/promises";
import path from "node:path";

export interface LearnerDiagnosisTraceRecord {
  readonly traceId: string;
  readonly request: unknown;
  readonly component: { readonly id: string; readonly version: string; readonly contentHash: string };
  readonly runtimeVersion: string;
  readonly diagnosis: unknown;
  readonly recommendedSupport: string | null;
  readonly timestamp: string;
}

const excludedKeys = new Set(["reasoning_content", "hidden_reasoning", "authorization", "api_key", "apikey"]);

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).flatMap(([key, nested]) => excludedKeys.has(key.toLowerCase()) ? [] : [[key, sanitize(nested)]]));
  }
  if (typeof value === "string" && (/^Bearer\s+/i.test(value) || /^sk-[A-Za-z0-9_-]{8,}$/.test(value))) return "[REDACTED]";
  return value;
}

export class LearnerDiagnosisTraceRepository {
  constructor(readonly directory: string) {}

  private file(traceId: string): string {
    if (!/^[A-Za-z0-9._-]+$/.test(traceId)) throw new Error("INVALID_DIAGNOSIS_TRACE_ID");
    return path.join(this.directory, `${traceId}.json`);
  }

  async save(record: LearnerDiagnosisTraceRecord): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    const target = this.file(record.traceId);
    const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
    try {
      await open(temp, "wx", 0o600).then(async (file) => {
        try { await file.writeFile(`${JSON.stringify(sanitize(record), null, 2)}\n`, "utf8"); await file.sync(); }
        finally { await file.close(); }
      });
      await link(temp, target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error(`DIAGNOSIS_TRACE_EXISTS: ${record.traceId}`);
      throw error;
    } finally {
      await unlink(temp).catch(() => undefined);
    }
  }

  async get(traceId: string): Promise<LearnerDiagnosisTraceRecord | null> {
    try { return JSON.parse(await readFile(this.file(traceId), "utf8")) as LearnerDiagnosisTraceRecord; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
  }

  async list(): Promise<readonly LearnerDiagnosisTraceRecord[]> {
    try {
      const names = (await readdir(this.directory)).filter((name) => name.endsWith(".json")).sort();
      return (await Promise.all(names.map((name) => this.get(name.slice(0, -5))))).filter((record): record is LearnerDiagnosisTraceRecord => record !== null).sort((left, right) => left.timestamp.localeCompare(right.timestamp));
    } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  }

  async clear(): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    await Promise.all((await readdir(this.directory)).filter((name) => name.endsWith(".json")).map((name) => unlink(path.join(this.directory, name))));
  }
}
