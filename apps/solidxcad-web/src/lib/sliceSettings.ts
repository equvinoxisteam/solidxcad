export type SliceSettings = {
  nozzleTemp: number;
  bedTemp: number;
  bedWidth: number;
  bedDepth: number;
  zHeight: number;
  nozzleDiameter: number;
  filamentDiameter: number;
  layerHeight: number;
  extrusionMultiplier: number;
  printSpeed: number;
  moveSpeed: number;
  topLayers: number;
  bottomLayers: number;
  brimCount: number;
  skirtCount: number;
  supportEnabled: boolean;
  filamentType: string;
  machineName: string;
};

const STORAGE_KEY = 'solidxcad.sliceSettings.v1';

export const DEFAULT_SLICE_SETTINGS: SliceSettings = {
  nozzleTemp: 200,
  bedTemp: 60,
  bedWidth: 220,
  bedDepth: 220,
  zHeight: 250,
  nozzleDiameter: 0.4,
  filamentDiameter: 1.75,
  layerHeight: 0.2,
  extrusionMultiplier: 100,
  printSpeed: 50,
  moveSpeed: 110,
  topLayers: 3,
  bottomLayers: 3,
  brimCount: 3,
  skirtCount: 3,
  supportEnabled: false,
  filamentType: 'PLA',
  machineName: 'Generic FDM',
};

export function loadSliceSettings(): SliceSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_SLICE_SETTINGS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SLICE_SETTINGS };
    return { ...DEFAULT_SLICE_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SLICE_SETTINGS };
  }
}

export function saveSliceSettings(settings: SliceSettings) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore quota errors
  }
}

export function isSliceableMesh(file: { name: string; kind: string; s3Key?: string }): boolean {
  if (file.kind === 'gcode' || /\.gcode$/i.test(file.name)) return false;
  if (file.s3Key?.includes('/slices/')) return false;
  if (file.kind === 'stl' || file.kind === 'step') return true;
  return /\.(stl|step|stp)$/i.test(file.name);
}
