import type { LegacyMemorisationItem } from "../domain/types";
import { fixtureProvenance } from "./provenance";

export const legacyDynamicEquilibriumDefinition = Object.freeze<LegacyMemorisationItem>({
  id: "as-def-045",
  stage: "AS",
  level: 1,
  topic: "equilibrium",
  subtopic: "dynamic-equilibrium",
  type: "definition",
  prompt: "Define dynamic equilibrium.",
  answer:
    "in a closed system, the rate of the forward reaction equals the rate of the reverse reaction and the concentrations of reactants and products remain constant",
  sourceScope: "syllabus_only",
  runtimeContext: Object.freeze({
    stage: "AS",
    levelId: "level-1-core",
    topicSlug: "equilibrium",
    fileId: "core-definitions",
    sourceId: "as-def-045",
    kind: "single",
    type: "definition",
    blankIndex: 0,
  }),
  provenanceId: fixtureProvenance.legacyDefinitions.id,
});

export const legacyPressureFixedConclusion = Object.freeze<LegacyMemorisationItem>({
  id: "as-fc-001",
  stage: "AS",
  level: 1,
  topic: "equilibrium",
  subtopic: "fixed-conclusion-increasing-pressure-shifts-equilibrium-to-side-with-moles-of-gas",
  type: "fixed_conclusion",
  prompt: "Complete the fixed conclusion: increasing pressure shifts the equilibrium to the side with ____ moles of gas.",
  answer: "fewer",
  runtimeContext: Object.freeze({
    stage: "AS",
    levelId: "level-1-core",
    topicSlug: "equilibrium",
    fileId: "core-fixed-conclusions",
    sourceId: "as-fc-001",
    kind: "single",
    type: "fixed_conclusion",
    blankIndex: 0,
  }),
  provenanceId: fixtureProvenance.legacyFixedConclusions.id,
});

export const legacyItems = Object.freeze([
  legacyDynamicEquilibriumDefinition,
  legacyPressureFixedConclusion,
]);
