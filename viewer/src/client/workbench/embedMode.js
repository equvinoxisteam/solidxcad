import { LIGHT_COLOR_SCHEME_ID, THEME_STORAGE_KEY, writeColorSchemePreference } from "@/ui/colorScheme.js";

const EMBED_THEME_STORAGE_VERSION = 11;

export function isViewerEmbedMode() {
  if (typeof window === "undefined") {
    return false;
  }
  return new URLSearchParams(window.location.search).get("embed") === "1";
}

export function applyViewerEmbedChrome() {
  if (!isViewerEmbedMode() || typeof document === "undefined") {
    return;
  }
  document.documentElement.classList.add("viewer-embed", "light");
  document.documentElement.classList.remove("dark");
  writeColorSchemePreference(LIGHT_COLOR_SCHEME_ID);
  try {
    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({
        version: EMBED_THEME_STORAGE_VERSION,
        activeThemeId: "blue",
        themes: [],
      }),
    );
  } catch {
    // ignore storage failures
  }
}

/** SolidX studio embed — friendly copy when the project has no models yet. */
export function embedStudioEmptyCopy() {
  return {
    heading: "What do you want to build?",
    body: "Describe your part in the Agent panel — it will appear here.",
    sidebar: "No models yet — ask the Agent to generate one.",
    searchPlaceholder: "Search workspace files…",
  };
}

/** User-facing studio error — no technical details, commands, or issue panels. */
export const EMBED_STUDIO_ERROR = Object.freeze({
  title: "Could not load this model",
  message: "Something went wrong.",
  hint: "Describe a new part in the Agent to create one.",
});

export function embedUserFacingViewerAlert(alert, { hasRenderableContent = false } = {}) {
  if (!alert || !isViewerEmbedMode()) {
    return alert;
  }
  if (hasRenderableContent) {
    return null;
  }
  return {
    severity: "error",
    blocking: alert.blocking !== false,
    compact: true,
    summary: "Error",
    title: EMBED_STUDIO_ERROR.title,
    message: `${EMBED_STUDIO_ERROR.message} ${EMBED_STUDIO_ERROR.hint}`,
  };
}

export function viewerEmptyHeading(fallback = "Select a file") {
  return isViewerEmbedMode() ? embedStudioEmptyCopy().heading : fallback;
}
