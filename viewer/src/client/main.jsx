import { StrictMode, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import CadWorkspace from "./components/CadWorkspace";
import faviconUrl from "./assets/favicon.ico";
import "./styles/globals.css";
import { getCadManifestSnapshot, subscribeCadManifest } from "./workbench/cadManifestStore.js";
import { applyViewerEmbedChrome } from "./workbench/embedMode.js";

const ROOT_ID = "root";
const ROOT_CACHE_KEY = "__cadViewerRoot";

function ensureFavicon() {
  if (typeof document === "undefined") {
    return;
  }

  const embedMode = new URLSearchParams(window.location.search).get("embed") === "1";
  let icon = document.querySelector('link[rel="icon"]');
  if (!icon) {
    icon = document.createElement("link");
    icon.rel = "icon";
    document.head.appendChild(icon);
  }
  if (embedMode) {
    icon.type = "image/png";
    icon.href = "/logo.png";
    return;
  }
  icon.type = "image/x-icon";
  icon.href = `${faviconUrl}?v=planetary-gear-workbench`;
}

function bootstrap() {
  const rootElement = document.getElementById(ROOT_ID);
  if (!rootElement) {
    throw new Error(`Missing #${ROOT_ID} mount point.`);
  }
  ensureFavicon();
  const embedMode = new URLSearchParams(window.location.search).get("embed") === "1";
  if (embedMode) {
    applyViewerEmbedChrome();
  }
  document.title = embedMode ? "SolidX CAD Workbench" : "CAD Viewer";
  const cachedRoot = globalThis[ROOT_CACHE_KEY];
  const root = cachedRoot?.element === rootElement && cachedRoot?.root
    ? cachedRoot.root
    : createRoot(rootElement);
  globalThis[ROOT_CACHE_KEY] = {
    element: rootElement,
    root
  };
  root.render(
    <StrictMode>
      <AppRoot />
    </StrictMode>,
  );
}

function AppRoot() {
  const { manifest, generationStatus, revision, catalogHydrated, catalogRefreshing, catalogError, activeDir } = useSyncExternalStore(
    subscribeCadManifest,
    getCadManifestSnapshot,
    getCadManifestSnapshot,
  );

  return (
    <CadWorkspace
      manifestRevision={revision}
      manifestEntries={manifest.entries}
      generationStatus={generationStatus}
      catalogHydrated={catalogHydrated}
      catalogRefreshing={catalogRefreshing}
      catalogError={catalogError}
      activeDir={activeDir}
    />
  );
}

bootstrap();
