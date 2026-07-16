import Ajv2020 from "ajv/dist/2020.js";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export interface CalculationCaseRecord {
  readonly caseId: string;
  readonly title: string;
  readonly distributionScope: "SCHOOL_INTERNAL" | "PUBLIC_ORIGINAL";
  readonly syllabusOutcomeIds: readonly string[];
  readonly calculationFamilyIds: readonly string[];
  readonly problemPrompt: string;
  readonly requiredEvidence: unknown;
  readonly canonicalStrategy: unknown;
  readonly validAlternativeStrategies: readonly unknown[];
  readonly expectedAnswer: unknown;
  readonly failureTaxonomy: readonly unknown[];
  readonly sourceRefs?: readonly string[];
  readonly teacherReview?: unknown;
}

async function readJson<T>(file: string): Promise<T> { return JSON.parse(await readFile(file, "utf8")) as T; }

export class CalculationCaseRepository {
  private constructor(readonly directory: string, private readonly records: ReadonlyMap<string, CalculationCaseRecord>) {}

  static async load(directory: string, schemaPath = path.join(directory, "calculation-case.schema.json")): Promise<CalculationCaseRepository> {
    const schema = await readJson<Record<string, unknown>>(schemaPath);
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
    const files = (await readdir(directory)).filter((file) => file.endsWith(".json") && file !== path.basename(schemaPath)).sort();
    const records = new Map<string, CalculationCaseRecord>();
    for (const file of files) {
      const record = await readJson<CalculationCaseRecord>(path.join(directory, file));
      const caseId = record.caseId;
      if (!validate(record)) throw new Error(`CALCULATION_CASE_SCHEMA_INVALID: ${file}: ${validate.errors?.map((error) => `${error.instancePath} ${error.message}`).join("; ")}`);
      if (records.has(caseId)) throw new Error(`DUPLICATE_CALCULATION_CASE: ${caseId}`);
      records.set(caseId, Object.freeze(record));
    }
    return new CalculationCaseRepository(directory, records);
  }

  async get(caseId: string): Promise<CalculationCaseRecord | null> { return this.records.get(caseId) ?? null; }
  async list(): Promise<readonly CalculationCaseRecord[]> { return [...this.records.values()]; }
}
