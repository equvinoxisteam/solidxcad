import path from "node:path";
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
  return sourceKind === "python" ? "" : sourceUrlFromEntry(entry);
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
    const url = outputUrlFromEntry(entry, outputRef || requestedFileRef);
    if (!url) {
      throw new Error(`Output file is not available in HTTP catalog for ${requestedFileRef || "(missing)"}`);
    }
    return {
      asset: assetKind,
      file: outputRef || requestedFileRef,
      url,
      filename: path.posix.basename(outputRef || requestedFileRef) || "download",
      contentType: contentTypeForFileRef(outputRef || requestedFileRef),
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

  return {
    kind: "http-catalog",
    catalogPath: "catalog.json",
    readCatalog,
    refreshCatalog,
    resolveFileAssetAccess,
    readFileAsset,
  };
}
