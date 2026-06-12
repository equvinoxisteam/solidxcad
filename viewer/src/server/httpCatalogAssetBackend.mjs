import path from "node:path";
import { GENERATION_STATUS_SCHEMA_VERSION } from "./catalog/generationStatus.mjs";
import { contentTypeForFileRef } from "./vercelBlobAssetBackend.mjs";

function normalizeFileRef(value) {
  const normalized = path.posix.normalize(String(value || "").trim().replace(/\\/g, "/").replace(/^\/+/, ""));
  return normalized && normalized !== "." && !normalized.startsWith("../") ? normalized : "";
}

function catalogEntryForFileRef(catalog, fileRef) {
  const normalized = normalizeFileRef(fileRef);
  if (!normalized || !Array.isArray(catalog?.entries)) {
    return null;
  }
  return catalog.entries.find((entry) => (
    normalizeFileRef(entry?.file) === normalized
  )) || null;
}

function normalizeString(value) {
  return String(value || "").trim();
}

function sourceUrlFromEntry(entry) {
  return normalizeString(entry?.sourceUrl || entry?.source?.url);
}

function stepUrlFromEntry(entry) {
  const explicitStepUrl = normalizeString(entry?.stepUrl || entry?.step?.url);
  if (explicitStepUrl) {
    return explicitStepUrl;
  }
  const sourceKind = String(entry?.sourceKind || entry?.stepSourceKind || "").trim().toLowerCase();
  if (sourceKind === "python") {
    return "";
  }
  // SolidX HTTP catalog entries expose presigned downloads on `url`.
  return sourceUrlFromEntry(entry) || normalizeString(entry?.url);
}

function stepFileRefFromEntry(entry, fallback = "") {
  return (
    normalizeFileRef(entry?.stepFile || entry?.step?.file || entry?.step?.path) ||
    normalizeFileRef(entry?.file || fallback)
  );
}

function artifactFileRefFromEntry(entry) {
  return (
    normalizeFileRef(entry?.assetFile || entry?.asset?.file || entry?.artifactFile || entry?.artifact?.file) ||
    normalizeFileRef(entry?.artifact?.glbPath) ||
    normalizeFileRef(filenameFromUrl(entry?.url))
  );
}

function filenameFromUrl(url) {
  try {
    return path.posix.basename(new URL(url).pathname);
  } catch {
    return "";
  }
}

function outputUrlFromEntry(entry, fileRef) {
  const extension = path.posix.extname(normalizeFileRef(fileRef)).toLowerCase();
  if (extension === ".step" || extension === ".stp") {
    return stepUrlFromEntry(entry);
  }
  return normalizeString(entry?.outputUrl || entry?.output?.url || entry?.url);
}

function normalizedFileAssetKind(value) {
  const asset = String(value || "output").trim().toLowerCase();
  if (asset === "asset") {
    return "artifact";
  }
  if (asset === "output" || asset === "source" || asset === "artifact") {
    return asset;
  }
  throw new Error(`Unsupported file asset: ${asset || "(missing)"}`);
}

async function readJsonFromUrl(url, { fetchImpl = globalThis.fetch } = {}) {
  if (!fetchImpl) {
    throw new Error("HTTP catalog backend requires fetch");
  }
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Failed to read HTTP catalog: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

function resolveCatalogUrl({ catalogUrl = "", defaultCatalogUrl = "" } = {}) {
  return normalizeString(catalogUrl) || normalizeString(defaultCatalogUrl);
}

export function createHttpCatalogAssetBackend({
  defaultCatalogUrl = "",
  fetchImpl = globalThis.fetch,
} = {}) {
  const catalogCache = new Map();

  async function readCatalog({ catalogUrl = "" } = {}) {
    const resolved = resolveCatalogUrl({ catalogUrl, defaultCatalogUrl });
    if (!resolved) {
      throw new Error("HTTP catalog backend requires ?catalogUrl= in the Viewer URL or VIEWER_CATALOG_URL");
    }
    const cached = catalogCache.get(resolved);
    if (cached && Date.now() - cached.at < 1500) {
      return cached.catalog;
    }
    const catalog = await readJsonFromUrl(resolved, { fetchImpl });
    catalogCache.set(resolved, { catalog, at: Date.now() });
    return catalog;
  }

  async function refreshCatalog(request = {}) {
    const resolved = resolveCatalogUrl(request);
    if (resolved) {
      catalogCache.delete(resolved);
    } else {
      catalogCache.clear();
    }
    return readCatalog(request);
  }

  async function resolveFileAssetAccess({ fileRef, asset = "output", catalog = null, catalogUrl = "" } = {}) {
    const assetKind = normalizedFileAssetKind(asset);
    const requestedFileRef = normalizeFileRef(fileRef);
    if (assetKind === "source") {
      throw new Error(
        `Source code is not available in HTTP catalog deployments for ${requestedFileRef || "(missing)"}`
      );
    }
    const currentCatalog = catalog || await readCatalog({ catalogUrl });
    const entry = catalogEntryForFileRef(currentCatalog, requestedFileRef);
    if (!entry) {
      throw new Error(`CAD catalog entry not found: ${requestedFileRef || "(missing)"}`);
    }

    const outputRef = normalizeFileRef(entry.file || requestedFileRef);
    const outputExtension = path.posix.extname(outputRef).toLowerCase();
    const explicitSourceUrl = sourceUrlFromEntry(entry);
    const explicitSourceRef = normalizeFileRef(entry?.source?.file || entry?.sourceFile || entry?.source?.path);
    const explicitStepUrl = stepUrlFromEntry(entry);
    const explicitStepRef = stepFileRefFromEntry(entry, outputRef);
    const explicitArtifactUrl = normalizeString(entry?.url);
    const explicitArtifactRef = artifactFileRefFromEntry(entry);
    const fileRefForAsset = assetKind === "source"
      ? explicitSourceRef
      : assetKind === "artifact"
        ? explicitArtifactRef
        : outputExtension === ".step" || outputExtension === ".stp"
          ? explicitStepRef
          : outputRef;
    const url = assetKind === "source"
      ? explicitSourceUrl
      : assetKind === "artifact"
        ? explicitArtifactUrl
        : outputUrlFromEntry(entry, fileRefForAsset || outputRef || requestedFileRef);
    if (!fileRefForAsset || !url) {
      throw new Error(
        assetKind === "artifact"
          ? `Artifact file is not available in HTTP catalog for ${requestedFileRef || "(missing)"}`
          : `Output file is not available in HTTP catalog for ${requestedFileRef || "(missing)"}`
      );
    }
    return {
      asset: assetKind,
      file: fileRefForAsset,
      url,
      filename: path.posix.basename(fileRefForAsset) || filenameFromUrl(url) || "download",
      contentType: contentTypeForFileRef(fileRefForAsset),
    };
  }

  async function readFileAsset(request = {}) {
    if (!fetchImpl) {
      throw new Error("HTTP catalog backend requires fetch to download file assets");
    }
    const access = await resolveFileAssetAccess(request);
    const response = await fetchImpl(access.url);
    if (!response.ok) {
      throw new Error(`Failed to download file asset: ${response.status} ${response.statusText}`);
    }
    const body = Buffer.from(await response.arrayBuffer());
    return {
      ...access,
      body,
    };
  }

  async function readGenerationStatus() {
    return {
      schemaVersion: GENERATION_STATUS_SCHEMA_VERSION,
      runs: [],
      files: {},
    };
  }

  async function readStepSourceStatus({ fileRef, catalog = null, catalogUrl = "" } = {}) {
    const requestedFileRef = normalizeFileRef(fileRef);
    const currentCatalog = catalog || await readCatalog({ catalogUrl });
    const entry = catalogEntryForFileRef(currentCatalog, requestedFileRef);
    if (!entry) {
      throw new Error(`STEP catalog entry not found: ${requestedFileRef || "(missing)"}`);
    }
    const repoStepRef = stepFileRefFromEntry(entry, requestedFileRef);
    const sourceKind = String(entry?.sourceKind || entry?.stepSourceKind || "step").trim().toLowerCase();
    const sourceUrl = stepUrlFromEntry(entry);

    return {
      ok: Boolean(sourceUrl),
      file: repoStepRef,
      stepPath: repoStepRef,
      sourceKind: sourceKind === "python" ? "python" : "step",
      step: sourceUrl
        ? {
            ok: true,
            status: "current",
            missing: false,
            stale: false,
          }
        : {
            ok: false,
            status: "missing",
            missing: true,
            stale: false,
            message: "STEP file is missing.",
          },
    };
  }

  return {
    kind: "http-catalog",
    canGenerateStepArtifacts: false,
    catalogPath: "catalog.json",
    readCatalog,
    refreshCatalog,
    readGenerationStatus,
    resolveFileAssetAccess,
    readFileAsset,
    readStepSourceStatus,
  };
}
