import { ParsedCommand } from "./commandParser";
import { EcomfyCommand } from "./commandRegistry";

export interface CreativeBrief {
  commands: string[];
  primary_command?: string;
  creative_mode: string;
  advertising_goal: string;
  quality_level: string;
  human_subject: {
    required: boolean;
    default_ethnicity: string;
    style: string;
    gender?: string;
    age?: string;
  };
  visual_style: {
    lighting: string;
    environment: string;
    camera: string;
    composition: string;
  };
  product_staging: string;
  notes: string[];
  product_fidelity: "strict";
}

/**
 * Resolves conflicts between parsed commands and constructs a unified Creative Brief
 */
export function resolveCommandsToCreativeBrief(parsedCommands: ParsedCommand[]): CreativeBrief {
  // Filter valid commands only and sort by priority descending
  const validCommands = parsedCommands
    .filter((c): c is ParsedCommand & { commandObj: EcomfyCommand } => !c.isUnknown && !!c.commandObj)
    .sort((a, b) => b.commandObj.priority - a.commandObj.priority);

  const activeCommandsList: string[] = [];
  const notes: string[] = [];

  // Active instructions accumulator
  let creativeMode = "";
  let advertisingGoal = "";
  let qualityLevel = "";
  let lighting = "";
  let environment = "";
  let camera = "";
  let composition = "";
  let humanStyle = "";
  let productStaging = "";
  let genderParam: string | undefined;
  let ageParam: string | undefined;
  let requiresHuman = false;

  // Track conflicting commands
  const excludedCommands = new Set<string>();

  for (const item of validCommands) {
    const cmd = item.commandObj;

    if (excludedCommands.has(cmd.command)) {
      notes.push(`Command ${cmd.command} omitted due to conflict with higher-priority command.`);
      continue;
    }

    // Mark conflicting commands as excluded
    if (cmd.conflicts_with) {
      for (const conflictToken of cmd.conflicts_with) {
        excludedCommands.add(conflictToken);
      }
    }

    activeCommandsList.push(cmd.command);

    // Capture parameters if provided (e.g. /UGCmodel:woman)
    if (item.parameter) {
      if (["woman", "man", "couple"].includes(item.parameter)) {
        genderParam = item.parameter;
      } else if (["young", "adult", "senior"].includes(item.parameter)) {
        ageParam = item.parameter;
      }
    }

    // Merge instructions hierarchically (higher priority wins if already set)
    if (!creativeMode && cmd.instructions.creative_mode) creativeMode = cmd.instructions.creative_mode;
    if (!advertisingGoal && cmd.instructions.advertising_goal) advertisingGoal = cmd.instructions.advertising_goal;
    if (!qualityLevel && cmd.instructions.quality_level) qualityLevel = cmd.instructions.quality_level;
    if (!lighting && cmd.instructions.lighting) lighting = cmd.instructions.lighting;
    if (!environment && cmd.instructions.environment) environment = cmd.instructions.environment;
    if (!camera && cmd.instructions.camera) camera = cmd.instructions.camera;
    if (!composition && cmd.instructions.composition) composition = cmd.instructions.composition;
    if (!humanStyle && cmd.instructions.human_style) humanStyle = cmd.instructions.human_style;
    if (!productStaging && cmd.instructions.product_staging) productStaging = cmd.instructions.product_staging;

    if (cmd.category === "UGC" || cmd.category === "Storytelling" || cmd.instructions.human_style) {
      requiresHuman = true;
    }

    if (cmd.instructions.notes) {
      notes.push(cmd.instructions.notes);
    }
  }

  // Handle specific resolution rules for conflicting pairs (e.g., /UGCnaturel + /Studio)
  const hasUgcNaturel = activeCommandsList.includes("/UGCnaturel");
  const hasStudio = activeCommandsList.includes("/Studio");

  if (hasUgcNaturel && hasStudio) {
    lighting = "Soft, controlled studio-quality daylight illumination preserving organic natural skin tones";
    notes.push("Hybrid resolution: Studio-quality soft lighting combined with natural everyday UGC organic scene.");
  }

  // Set default parameters
  const primaryCmd = validCommands[0]?.commandObj.command;

  return {
    commands: activeCommandsList,
    primary_command: primaryCmd,
    creative_mode: creativeMode || "Ecomfy High-End E-commerce Visual",
    advertising_goal: advertisingGoal || "Commercial E-commerce Conversion",
    quality_level: qualityLevel || "Studio Commercial Premium",
    human_subject: {
      required: requiresHuman,
      default_ethnicity: "African",
      style: humanStyle || (requiresHuman ? "Authentic contemporary African model with warm expression" : ""),
      gender: genderParam,
      age: ageParam,
    },
    visual_style: {
      lighting: lighting || "Soft commercial studio lighting with rim lights",
      environment: environment || "Clean modern lifestyle or studio backdrop",
      camera: camera || "85mm f/1.4 lens, sharp focus, natural depth of field",
      composition: composition || "Balanced commercial framing with hero product prominent",
    },
    product_staging: productStaging || "Hero product presented with maximum visual clarity and packaging preservation",
    notes,
    product_fidelity: "strict",
  };
}
