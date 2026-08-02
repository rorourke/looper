import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DEMO_ACCOUNT_EMAIL,
  createDemoTimeLibraryDocuments,
  createDemoTimeDocuments,
  demoSheetDefinitions
} from "./demoTime.ts";
import {
  createGettingStartedDocuments,
  gettingStartedExampleSection,
  isGettingStartedExampleDocumentId
} from "./gettingStartedDocument.ts";
import { GlobalVariableWorkbook } from "./globalVariables.ts";

test("provides exactly 19 isolated demo sheets for the launch library", () => {
  const documents = createDemoTimeDocuments(new Date("2026-08-01T12:00:00.000Z"));

  assert.equal(DEMO_ACCOUNT_EMAIL, "demo@looper.app");
  assert.equal(demoSheetDefinitions.length, 19);
  assert.equal(documents.length, 19);
  assert.equal(new Set(documents.map((document) => document.id)).size, 19);
  assert.equal(new Set(documents.map((document) => document.title)).size, 19);
  assert.ok(documents.every((document) => document.demo));
  assert.ok(documents.every((document) => !document.id.startsWith("builtin-")));
});

test("the Demo Time library retains every Looper Basics and Templates sheet", () => {
  const now = new Date("2026-08-01T12:00:00.000Z");
  const demoLibrary = createDemoTimeLibraryDocuments(now);
  const bundledDocuments = createGettingStartedDocuments(now.toISOString());
  const retainedBundledDocuments = demoLibrary.filter((document) =>
    isGettingStartedExampleDocumentId(document.id)
  );

  assert.deepEqual(
    retainedBundledDocuments.map((document) => document.id),
    bundledDocuments.map((document) => document.id)
  );
  assert.ok(
    retainedBundledDocuments.some(
      (document) => gettingStartedExampleSection(document.id) === "learn"
    )
  );
  assert.ok(
    retainedBundledDocuments.some(
      (document) => gettingStartedExampleSection(document.id) === "template"
    )
  );
});

test("every demo sheet evaluates without formula errors", () => {
  const documents = createDemoTimeDocuments();
  const workbook = new GlobalVariableWorkbook(
    documents.map((document) => ({
      decimalPlaces: document.data.decimalPlaces,
      id: document.id,
      loopCount: document.data.loopCount,
      text: document.data.text,
      title: document.title
    })),
    {}
  );

  for (const document of documents) {
    const evaluation = workbook.evaluateDocument(document.id);
    assert.equal(
      evaluation.errors,
      0,
      `${document.title} should not contain formula errors`
    );
  }
});

test("the capacity plan demonstrates a global from the construction budget", () => {
  const documents = createDemoTimeDocuments();
  const construction = documents.find((document) => document.id === "demo-cedar-ridge-build");
  const capacity = documents.find((document) => document.id === "demo-consulting-capacity");

  assert.match(construction?.data.text ?? "", /@cedar_ridge_budget\s*=/);
  assert.match(capacity?.data.text ?? "", /@cedar_ridge_budget/);
});

test("keeps the demo library separate, ephemeral, and available to local builds", async () => {
  const [app, main, viteConfig, buildAndRun] = await Promise.all([
    readFile(new URL("./App.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../main/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../../../electron.vite.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../../../../script/build_and_run.sh", import.meta.url), "utf8")
  ]);

  assert.match(app, /actualLibraryDocuments/);
  assert.match(app, /demoLibraryDocuments/);
  assert.match(app, /createDemoTimeLibraryDocuments/);
  assert.match(
    app,
    /if \(publicDemoMode \|\| demoTimeEnabled\) return;\s*try \{\s*const localDocuments/s
  );
  assert.match(app, /Sharing is disabled in Demo Time/);
  assert.match(app, /Account deletion is disabled in Demo Time/);
  assert.match(main, /isInternalDebugBuild \|\|\s*demoTimeEnabled/);
  assert.match(viteConfig, /__LOOPER_INTERNAL_DEBUG_BUILD__/);
  assert.match(buildAndRun, /MAIN_VITE_INTERNAL_DEBUG_BUILD/);
});
