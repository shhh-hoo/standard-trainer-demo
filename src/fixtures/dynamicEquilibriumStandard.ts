import type { ActiveStandard, StandardNode } from "../domain/types";
import { legacyDynamicEquilibriumDefinition } from "./legacyItems";
import { fixtureProvenance } from "./provenance";

export const dynamicEquilibriumStandardNode = Object.freeze<StandardNode>({
  id: "cambridge-a-level-chem-dynamic-equilibrium-v0.1",
  concept: "Dynamic equilibrium",
  prompt: "Define dynamic equilibrium.",
  legacyContentIds: Object.freeze(["as-def-045"]),
  board: "Cambridge International",
  syllabusCode: "9701",
  syllabusCycle: "2025-2027",
  topic: "equilibrium",
  version: "0.1",
  rubricVersion: "de-v0.1",
  deterministicRuleVersion: "de-deterministic-v1",
  requirementSummary:
    "Draft rubric: a reversible reaction in a closed system remains dynamic because forward and reverse reactions continue at equal rates while macroscopic composition remains constant.",
  referenceAnswer:
    "In a closed system, the forward and reverse reactions continue at equal rates while reactant and product concentrations remain constant with time.",
  requiredElements: Object.freeze([
    Object.freeze({
      id: "closed_system",
      description: "The equilibrium is established in a closed system.",
      required: true,
      acceptedPatterns: Object.freeze(["\\bclosed system\\b", "\\bsealed (?:container|vessel)\\b"]),
      sourceIds: Object.freeze([fixtureProvenance.draftRubric.id]),
    }),
    Object.freeze({
      id: "forward_and_reverse_continue",
      description: "Forward and reverse reactions continue.",
      required: true,
      acceptedPatterns: Object.freeze([
        "\\bforward and (?:reverse|backward) reactions? (?:continue|keep occurring)\\b",
        "\\bboth (?:directions|reactions) (?:continue|keep occurring)\\b",
        "\\breactants? and products? (?:keep )?interconvert(?:ing)?\\b",
      ]),
      sourceIds: Object.freeze([fixtureProvenance.draftRubric.id]),
    }),
    Object.freeze({
      id: "equal_rates",
      description: "Forward and reverse reaction rates are equal.",
      required: true,
      acceptedPatterns: Object.freeze([
        "\\b(?:forward|forwards?) and (?:reverse|backward) reactions? (?:(?:continue|keep occurring) )?(?:at|have) (?:the )?(?:same|equal) (?:rate|speed)s?\\b",
        "\\brate of (?:the )?forward reaction (?:equals|is equal to) (?:the )?rate of (?:the )?(?:reverse|backward) reaction\\b",
        "\\bboth (?:directions|reactions) (?:(?:continue|keep occurring|proceed|occur) )?(?:at )?(?:the )?(?:same|equal) (?:rate|speed)s?\\b",
        "\\bboth directions (?:proceed|occur) equally fast\\b",
      ]),
      sourceIds: Object.freeze([fixtureProvenance.draftRubric.id]),
    }),
    Object.freeze({
      id: "constant_macroscopic_composition",
      description:
        "Reactant and product concentrations or macroscopic composition remain constant with time, not necessarily equal.",
      required: true,
      acceptedPatterns: Object.freeze([
        "\\bconcentrations?(?: of reactants? and products?)? (?:remain|stay|are) constant(?: with time)?\\b",
        "\\b(?:macroscopic )?composition (?:remains|stays|is) constant(?: with time)?\\b",
        "\\bconcentrations? (?:do not|don t) change with time\\b",
        "\\bno net macroscopic (?:composition|concentration) change\\b",
      ]),
      sourceIds: Object.freeze([fixtureProvenance.draftRubric.id]),
    }),
  ]),
  dangerousClaims: Object.freeze([
    Object.freeze({
      id: "reactions_stop",
      label: "The reactions stop",
      reason: "Dynamic equilibrium retains ongoing microscopic reactions.",
      boundaryError: "static_not_dynamic",
      patterns: Object.freeze([
        "\\b(?:both |forward and reverse )?reactions? (?:stop|have stopped|cease)\\b",
      ]),
      sourceIds: Object.freeze([fixtureProvenance.draftRubric.id]),
    }),
    Object.freeze({
      id: "concentrations_are_equal",
      label: "Reactant and product concentrations are equal",
      reason: "Constant concentration does not imply equal concentration.",
      boundaryError: "constant_does_not_mean_equal",
      patterns: Object.freeze([
        "\\bconcentrations? of reactants? and products? (?:are|become|remain) equal\\b",
        "\\breactant and product concentrations? (?:are|become|remain) equal\\b",
      ]),
      sourceIds: Object.freeze([fixtureProvenance.draftRubric.id]),
    }),
  ]),
  sourceStatus: "AI_DRAFT",
  reviewerStatus: "not_reviewed",
  sourceIds: Object.freeze([fixtureProvenance.draftRubric.id, fixtureProvenance.legacyDefinitions.id]),
});

export const activeDynamicEquilibriumStandard = Object.freeze<ActiveStandard>({
  node: dynamicEquilibriumStandardNode,
  evidence: Object.freeze({
    sourceIds: dynamicEquilibriumStandardNode.sourceIds,
    hasValidSourceConflict: false,
  }),
  legacyReferences: Object.freeze([legacyDynamicEquilibriumDefinition]),
});
