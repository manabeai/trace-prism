// @vitest-environment jsdom
import { BundleType } from '@tauri-apps/api/app';
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UpdateControl } from '../../src/updater/UpdateControl';
import type { UpdateService } from '../../src/updater/update-service';

afterEach(cleanup);

describe('desktop updates', () => {
  it('offers a signed update and relaunches after installation', async () => {
    const downloadAndInstall = vi.fn(async () => {});
    const relaunch = vi.fn(async () => {});
    const service: UpdateService = {
      bundleType: async () => BundleType.AppImage,
      check: async () => ({ version: '0.2.2-preview.1', downloadAndInstall }),
      relaunch,
    };

    render(() => <UpdateControl service={service} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Update to 0.2.2-preview.1' }));

    await vi.waitFor(() => {
      expect(downloadAndInstall).toHaveBeenCalledOnce();
      expect(relaunch).toHaveBeenCalledOnce();
    });
  });

  it('sends Debian users to the release installers', async () => {
    const check = vi.fn(async () => null);
    const service: UpdateService = {
      bundleType: async () => BundleType.Deb,
      check,
      relaunch: async () => {},
    };

    render(() => <UpdateControl service={service} />);

    const link = await screen.findByRole('link', { name: 'Download update' });
    expect(link.getAttribute('href')).toBe('https://github.com/manabeai/trace-prism/releases');
    expect(check).not.toHaveBeenCalled();
  });
});
