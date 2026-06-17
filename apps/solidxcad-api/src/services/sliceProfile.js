import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function apiConfigDir() {
  return path.join(__dirname, '../config');
}

export function defaultSliceSettings() {
  return {
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
}

function resolveNativeConfigPaths() {
  const configDir = apiConfigDir();
  const machineJson = path.join(configDir, 'orcaslicer-ender3-machine.json');
  const bundledProfile = path.join(configDir, 'orcaslicer-ender3-pla.json');
  if (config.slicerProfilePath) {
    return { profilePath: config.slicerProfilePath, machineJson };
  }
  return { profilePath: bundledProfile, machineJson };
}

async function attachOrcaBundledProfiles(profile, machineJson) {
  const orcaRoot = process.env.ORCASLICER_ROOT || '';
  profile.native_config = machineJson;
  profile.native_settings = [machineJson];
  if (!orcaRoot) return profile;

  const processJson = path.join(
    orcaRoot,
    'resources/profiles/Creality/process/0.20mm Standard @Creality Ender3 0.4.json',
  );
  const filamentJson = path.join(
    orcaRoot,
    'resources/profiles/Creality/filament/Creality Generic PLA.json',
  );

  try {
    await fs.access(processJson);
    profile.native_settings = [machineJson, processJson];
    profile.backend = 'orcaslicer';
  } catch {
    // machine json only
  }

  try {
    await fs.access(filamentJson);
    profile.native_filaments = [filamentJson];
  } catch {
    delete profile.native_filaments;
  }

  return profile;
}

export async function buildSliceProfileJson(settings = {}) {
  const merged = { ...defaultSliceSettings(), ...settings };
  const { profilePath, machineJson } = resolveNativeConfigPaths();

  if (config.slicerProfilePath) {
    try {
      const raw = await fs.readFile(config.slicerProfilePath, 'utf8');
      const base = JSON.parse(raw);
      return attachOrcaBundledProfiles(
        patchProfileWithSettings(base, merged, machineJson),
        machineJson,
      );
    } catch {
      // fall through to generated profile
    }
  }

  const bedW = Number(merged.bedWidth) || 220;
  const bedD = Number(merged.bedDepth) || 220;
  const zH = Number(merged.zHeight) || 250;

  const profile = {
    backend: 'auto',
    native_config: machineJson,
    native_settings: [machineJson],
    machine: {
      name: merged.machineName || 'Generic FDM',
      bed_size_mm: [bedW, bedD],
      z_height_mm: zH,
      motion_bounds_mm: {
        x: [0, bedW],
        y: [0, bedD],
        z: [0, zH],
      },
    },
    filament: {
      type: merged.filamentType || 'PLA',
      nozzle_temp_c: Number(merged.nozzleTemp) || 200,
      bed_temp_c: Number(merged.bedTemp) || 60,
    },
    slice: {
      layer_height_mm: Number(merged.layerHeight) || 0.2,
      nozzle_diameter_mm: Number(merged.nozzleDiameter) || 0.4,
      filament_diameter_mm: Number(merged.filamentDiameter) || 1.75,
      extrusion_multiplier_pct: Number(merged.extrusionMultiplier) || 100,
      print_speed_mm_s: Number(merged.printSpeed) || 50,
      move_speed_mm_s: Number(merged.moveSpeed) || 110,
      top_layers: Number(merged.topLayers) || 3,
      bottom_layers: Number(merged.bottomLayers) || 3,
      brim_count: Number(merged.brimCount) || 0,
      skirt_count: Number(merged.skirtCount) || 3,
      support_enabled: Boolean(merged.supportEnabled),
    },
  };

  if (profilePath !== machineJson) {
    try {
      const raw = await fs.readFile(profilePath, 'utf8');
      const base = JSON.parse(raw);
      if (base.native_config) profile.native_config = base.native_config;
      if (base.native_settings) profile.native_settings = base.native_settings;
      if (base.native_filaments) profile.native_filaments = base.native_filaments;
      if (base.backend) profile.backend = base.backend;
    } catch {
      // use machine json only
    }
  }

  return attachOrcaBundledProfiles(profile, machineJson);
}

function patchProfileWithSettings(base, merged, machineJson) {
  const bedW = Number(merged.bedWidth) || base.machine?.bed_size_mm?.[0] || 220;
  const bedD = Number(merged.bedDepth) || base.machine?.bed_size_mm?.[1] || 220;
  const zH = Number(merged.zHeight) || base.machine?.z_height_mm || 250;

  return {
    ...base,
    native_config: base.native_config || machineJson,
    machine: {
      ...(base.machine || {}),
      name: merged.machineName || base.machine?.name || 'Generic FDM',
      bed_size_mm: [bedW, bedD],
      z_height_mm: zH,
      motion_bounds_mm: {
        x: [0, bedW],
        y: [0, bedD],
        z: [0, zH],
      },
    },
    filament: {
      ...(base.filament || {}),
      type: merged.filamentType || base.filament?.type || 'PLA',
      nozzle_temp_c: Number(merged.nozzleTemp) || base.filament?.nozzle_temp_c || 200,
      bed_temp_c: Number(merged.bedTemp) || base.filament?.bed_temp_c || 60,
    },
    slice: {
      layer_height_mm: Number(merged.layerHeight) || 0.2,
      nozzle_diameter_mm: Number(merged.nozzleDiameter) || 0.4,
      filament_diameter_mm: Number(merged.filamentDiameter) || 1.75,
      extrusion_multiplier_pct: Number(merged.extrusionMultiplier) || 100,
      print_speed_mm_s: Number(merged.printSpeed) || 50,
      move_speed_mm_s: Number(merged.moveSpeed) || 110,
      top_layers: Number(merged.topLayers) || 3,
      bottom_layers: Number(merged.bottomLayers) || 3,
      brim_count: Number(merged.brimCount) || 0,
      skirt_count: Number(merged.skirtCount) || 3,
      support_enabled: Boolean(merged.supportEnabled),
    },
  };
}

export async function writeTempSliceProfile(workDir, settings = {}) {
  const profile = await buildSliceProfileJson(settings);
  const profilePath = path.join(workDir, 'slice-profile.json');
  await fs.writeFile(profilePath, JSON.stringify(profile, null, 2), 'utf8');
  return profilePath;
}
