import assert from "node:assert/strict";
import test from "node:test";
import { createHttpCatalogAssetBackend } from "./httpCatalogAssetBackend.mjs";

const catalog = {
  schemaVersion: 4,
  entries: [
    {
      file: "models/part_1781251261403.step",
      kind: "step",
      sourceKind: "step",
      url: "https://s3.example.com/part.step?sig=abc",
      bytes: 1024,
    },
  ],
};

test("http catalog backend reports STEP source status from catalog url", async () => {
  const backend = createHttpCatalogAssetBackend({
    defaultCatalogUrl: "https://api.example.com/catalog.json",
    fetchImpl: async () => ({
      ok: true,
      json: async () => catalog,
    }),
  });

  const status = await backend.readStepSourceStatus({
    fileRef: "models/part_1781251261403.step",
    catalog,
  });

  assert.equal(status.ok, true);
  assert.equal(status.file, "models/part_1781251261403.step");
  assert.equal(status.step.status, "current");
  assert.equal(status.step.missing, false);
});

test("http catalog backend returns idle generation status", async () => {
  const backend = createHttpCatalogAssetBackend();
  const status = await backend.readGenerationStatus();
  assert.equal(status.schemaVersion, 1);
  assert.deepEqual(status.runs, []);
  assert.deepEqual(status.files, {});
});

test("http catalog backend resolves STEP download url from entry.url", async () => {
  const backend = createHttpCatalogAssetBackend({
    defaultCatalogUrl: "https://api.example.com/catalog.json",
  });

  const access = await backend.resolveFileAssetAccess({
    fileRef: "models/part_1781251261403.step",
    catalog,
  });

  assert.equal(access.url, "https://s3.example.com/part.step?sig=abc");
});

test("http catalog backend resolves GLB artifact url for STEP part entries", async () => {
  const partCatalog = {
    schemaVersion: 4,
    entries: [
      {
        file: "models/part_1781262354024.step",
        kind: "part",
        url: "https://s3.example.com/.part_1781262354024.step.glb?sig=glb",
        hash: "abc-123",
        sourceKind: "step",
        source: {
          file: "models/part_1781262354024.step",
          url: "https://s3.example.com/part_1781262354024.step?sig=step",
        },
        artifact: {
          ok: true,
          glbPath: "models/.part_1781262354024.step.glb",
        },
      },
    ],
  };
  const backend = createHttpCatalogAssetBackend();

  const output = await backend.resolveFileAssetAccess({
    fileRef: "models/part_1781262354024.step",
    catalog: partCatalog,
  });
  const artifact = await backend.resolveFileAssetAccess({
    fileRef: "models/part_1781262354024.step",
    asset: "artifact",
    catalog: partCatalog,
  });

  assert.equal(output.url, "https://s3.example.com/part_1781262354024.step?sig=step");
  assert.equal(artifact.url, "https://s3.example.com/.part_1781262354024.step.glb?sig=glb");
});
