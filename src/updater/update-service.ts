import { BundleType, getBundleType } from '@tauri-apps/api/app';
import { relaunch } from '@tauri-apps/plugin-process';
import { check } from '@tauri-apps/plugin-updater';

export interface AvailableUpdate {
  version: string;
  downloadAndInstall(): Promise<void>;
}

export interface UpdateService {
  bundleType(): Promise<BundleType>;
  check(): Promise<AvailableUpdate | null>;
  relaunch(): Promise<void>;
}

export const tauriUpdateService: UpdateService = {
  bundleType: getBundleType,
  check,
  relaunch,
};

export function supportsInAppUpdates(bundleType: BundleType): boolean {
  return bundleType !== BundleType.Deb && bundleType !== BundleType.Rpm;
}
