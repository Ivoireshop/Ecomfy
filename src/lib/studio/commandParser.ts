import { EcomfyCommand, findCommandByToken } from "./commandRegistry";

export interface ParsedCommand {
  rawToken: string;
  commandObj?: EcomfyCommand;
  baseCommand: string;
  parameter?: string;
  isUnknown: boolean;
}

export interface ParseResult {
  rawPrompt: string;
  cleanPrompt: string; // User's prompt with slash commands stripped
  commands: ParsedCommand[];
  unknownCommands: string[];
  hasCommands: boolean;
}

/**
 * Parses user prompt string for slash commands (e.g., "/UGCmodel /FacebookAds /Premium")
 */
export function parseCommandPrompt(inputPrompt: string): ParseResult {
  if (!inputPrompt || typeof inputPrompt !== "string") {
    return {
      rawPrompt: "",
      cleanPrompt: "",
      commands: [],
      unknownCommands: [],
      hasCommands: false,
    };
  }

  const rawPrompt = inputPrompt;
  const commands: ParsedCommand[] = [];
  const unknownCommands: string[] = [];

  // Regex to match slash tokens (e.g., /UGCmodel, /UGCmodel:woman, /FacebookAds)
  // Ensures we match tokens starting with / followed by letters/digits/hyphens/colons
  const slashRegex = /(?:^|\s)(\/([a-zA-Z0-9_-]+)(?::([a-zA-Z0-9_-]+))?)(?=\s|$|[.,!?;])/g;

  let match: RegExpExecArray | null;
  const matchedTokens: string[] = [];

  while ((match = slashRegex.exec(rawPrompt)) !== null) {
    const fullMatchedToken = match[1]; // e.g. "/UGCmodel:woman"
    const commandName = match[2];     // e.g. "UGCmodel"
    const parameter = match[3];       // e.g. "woman"
    const baseToken = `/${commandName}`;

    matchedTokens.push(fullMatchedToken);

    const foundCmd = findCommandByToken(baseToken);

    if (foundCmd && foundCmd.enabled) {
      // Avoid duplicate commands of the same base type
      const exists = commands.some(c => c.commandObj?.command === foundCmd.command);
      if (!exists) {
        commands.push({
          rawToken: fullMatchedToken,
          commandObj: foundCmd,
          baseCommand: foundCmd.command,
          parameter,
          isUnknown: false,
        });
      }
    } else {
      unknownCommands.push(fullMatchedToken);
      commands.push({
        rawToken: fullMatchedToken,
        baseCommand: baseToken,
        parameter,
        isUnknown: true,
      });
    }
  }

  // Strip matched command tokens from literal user prompt
  let cleanPrompt = rawPrompt;
  for (const token of matchedTokens) {
    // Replace token with space safely
    const escapedToken = token.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    cleanPrompt = cleanPrompt.replace(new RegExp(`(?:^|\\s)${escapedToken}(?=\\s|$|[.,!?;])`, "g"), " ");
  }

  // Clean up extra spaces
  cleanPrompt = cleanPrompt.replace(/\s+/g, " ").trim();

  return {
    rawPrompt,
    cleanPrompt,
    commands,
    unknownCommands,
    hasCommands: commands.filter(c => !c.isUnknown).length > 0,
  };
}
