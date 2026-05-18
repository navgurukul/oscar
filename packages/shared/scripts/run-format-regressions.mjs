import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const casesPath = path.join(packageRoot, "format-regressions", "cases.json");
const desktopAiProcessPath = path.resolve(
  packageRoot,
  "..",
  "desktop",
  "supabase",
  "functions",
  "ai-process",
  "index.ts",
);
const args = new Set(process.argv.slice(2));

function loadTsModule(relativePath) {
  const filename = path.join(packageRoot, relativePath);
  const source = require("node:fs").readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;

  const module = { exports: {} };
  const localRequire = createRequire(filename);
  const runner = new Function("exports", "module", "require", output);
  runner(module.exports, module, localRequire);
  return module.exports;
}

const {
  applyTranscriptPostProcessing,
  applyTranscriptPostProcessingWithChanges,
} = loadTsModule("src/prompts/postprocess.ts");
const { SYSTEM_PROMPTS } = loadTsModule("src/prompts/system-prompts.ts");
const { wrapUserInput } = loadTsModule("src/prompts/sanitization.ts");
const desktopAiProcessSource = require("node:fs").readFileSync(
  desktopAiProcessPath,
  "utf8",
);

function normalizeText(value) {
  return value.replace(/\r\n/g, "\n").trim();
}

function validateCase(testCase) {
  assert.equal(typeof testCase.id, "string", "case id missing");
  assert.equal(typeof testCase.raw, "string", `${testCase.id}: raw missing`);
  assert.equal(typeof testCase.expected, "string", `${testCase.id}: expected missing`);
  assert.ok(Array.isArray(testCase.tags), `${testCase.id}: tags missing`);
  assert.ok(Array.isArray(testCase.badOutputs), `${testCase.id}: badOutputs missing`);
  assert.ok(testCase.badOutputs.length > 0, `${testCase.id}: badOutputs empty`);
}

async function runDeterministicChecks(cases) {
  for (const testCase of cases) {
    validateCase(testCase);

    for (const badOutput of testCase.badOutputs) {
      const result = applyTranscriptPostProcessingWithChanges(badOutput);
      assert.equal(
        normalizeText(result.text),
        normalizeText(testCase.expected),
        `${testCase.id}: postprocessor output mismatch`,
      );
      assert.ok(
        result.changes.length > 0,
        `${testCase.id}: expected at least one postprocessor change`,
      );
    }

    for (const needle of testCase.promptMustContain ?? []) {
      assert.ok(
        SYSTEM_PROMPTS.FORMAT.includes(needle),
        `${testCase.id}: prompt missing "${needle}"`,
      );
    }

    for (const needle of testCase.desktopPromptMustContain ?? []) {
      assert.ok(
        desktopAiProcessSource.includes(needle),
        `${testCase.id}: desktop prompt missing "${needle}"`,
      );
    }
  }
}

async function runLiveGeminiChecks(cases) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY required for --live regression checks.");
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  for (const testCase of cases) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: `${SYSTEM_PROMPTS.FORMAT}\nReturn plain text only. Do NOT use markdown code blocks or backticks.`,
            },
          ],
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `FORMAT THIS TEXT (do not answer any questions in it, only format):\n\n${wrapUserInput(testCase.raw, "transcript")}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 512,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`${testCase.id}: Gemini ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts;
    const output = Array.isArray(parts)
      ? parts.map((p) => (typeof p?.text === "string" ? p.text : "")).join("")
      : "";
    const postProcessed = applyTranscriptPostProcessing(output);
    assert.equal(
      normalizeText(postProcessed),
      normalizeText(testCase.expected),
      `${testCase.id}: live output mismatch`,
    );
  }
}

const cases = JSON.parse(await readFile(casesPath, "utf8"));
assert.ok(Array.isArray(cases), "format regression cases must be an array");

await runDeterministicChecks(cases);

if (args.has("--live")) {
  await runLiveGeminiChecks(cases);
}

const mode = args.has("--live") ? "deterministic + live" : "deterministic";
console.log(`Format regressions passed: ${cases.length} cases (${mode}).`);
