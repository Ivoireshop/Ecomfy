import { parseCommandPrompt } from "../commandParser";
import { resolveCommandsToCreativeBrief } from "../commandResolver";
import { findCommandByToken } from "../commandRegistry";

/**
 * Unit Test Suite for Ecomfy Studio IA /command Engine
 */
export function runCommandEngineTests() {
  console.log("=== RUNNING ECOMFY STUDIO IA /COMMAND ENGINE UNIT TESTS ===");

  let passCount = 0;
  let failCount = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passCount++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failCount++;
    }
  }

  // Test 1: Registry Lookup
  const ugcCmd = findCommandByToken("/UGCmodel");
  assert(ugcCmd !== undefined && ugcCmd.name === "UGC Model Commercial", "Registry finds /UGCmodel");

  const ugcNaturelCmd = findCommandByToken("/UGCnaturel");
  assert(ugcNaturelCmd !== undefined && ugcNaturelCmd.category === "UGC", "Registry finds /UGCnaturel");

  const fbAdsCmd = findCommandByToken("/FacebookAds");
  assert(fbAdsCmd !== undefined && fbAdsCmd.category === "Publicité", "Registry finds /FacebookAds");

  // Test 2: Parsing single and multiple commands
  const res1 = parseCommandPrompt("Un produit de beauté avec une femme /UGCmodel /FacebookAds /Premium");
  assert(res1.hasCommands === true, "Parses multiple commands");
  assert(res1.commands.length === 3, "Finds 3 valid commands");
  assert(res1.cleanPrompt === "Un produit de beauté avec une femme", "Strips command tokens from clean prompt");

  // Test 3: Parameterized commands (e.g. /UGCmodel:woman)
  const res2 = parseCommandPrompt("Crée une pub /UGCmodel:woman /FacebookAds");
  assert(res2.commands.length === 2, "Parses 2 commands with parameter");
  assert(res2.commands[0].parameter === "woman", "Extracts parameter 'woman'");

  // Test 4: Unknown command handling (e.g. /MaCommandeInconnue)
  const res3 = parseCommandPrompt("Fais une création /MaCommandeInconnue /FacebookAds");
  assert(res3.commands.length === 2, "Parses commands including unknown");
  assert(res3.unknownCommands.length === 1, "Detects 1 unknown command");
  assert(res3.unknownCommands[0] === "/MaCommandeInconnue", "Records raw token of unknown command");
  assert(res3.cleanPrompt === "Fais une création", "Strips unknown command safely without crash");

  // Test 5: Conflict Resolution (/UGCmodel vs /UGCnaturel)
  const res4 = parseCommandPrompt("Produit /UGCmodel /UGCnaturel");
  const brief4 = resolveCommandsToCreativeBrief(res4.commands);
  assert(brief4.commands.includes("/UGCmodel"), "Higher priority command /UGCmodel retained");
  assert(!brief4.commands.includes("/UGCnaturel"), "Conflicting lower priority /UGCnaturel excluded");

  // Test 6: Non-regression for prompts without slash commands
  const res5 = parseCommandPrompt("Crée une belle publicité pour ce produit e-commerce");
  assert(res5.hasCommands === false, "Returns false for prompt without commands");
  assert(res5.cleanPrompt === "Crée une belle publicité pour ce produit e-commerce", "Preserves exact original text");

  // Test 7: Creative Brief Building for /Product /Luxury /FacebookAds
  const res6 = parseCommandPrompt("Photo de ce flacon /Product /Luxury /FacebookAds");
  const brief6 = resolveCommandsToCreativeBrief(res6.commands);
  assert(brief6.advertising_goal.includes("Facebook"), "Sets Facebook advertising goal");
  assert(brief6.quality_level.includes("Quality") || brief6.visual_style.environment.includes("luxury") || brief6.visual_style.environment.includes("Luxury"), "Applies luxury environment instructions");

  console.log(`=== TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED ===`);
  return { passCount, failCount };
}
