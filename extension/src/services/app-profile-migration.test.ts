import { expect, it } from '@jest/globals';
import type { ChromeExtension } from '@project/common/app';
import { AppExtensionSettingsStorage } from '@project/common/app/services/app-extension-settings-storage';
import { SettingsProvider, activeProfileKey, profilesKey } from '@project/common/settings';
import { ExtensionSettingsStorage } from '@project/extension/src/services/extension-settings-storage';
import { MockStorageArea } from '@project/extension/src/services/mock-storage-area';

it('loads the preserved Default profile through the web app extension adapter', async () => {
    const storage = new MockStorageArea();
    await storage.set({ language: 'es', [profilesKey]: [{ name: 'Japanese' }] });
    const extensionStorage = new ExtensionSettingsStorage(storage);
    // The content script dispatches these extension requests to ExtensionSettingsStorage.
    const extension = {
        settingsProfiles: () => extensionStorage.profiles(),
        activeSettingsProfile: () => extensionStorage.activeProfile(),
        getSettings: (defaults: Parameters<ExtensionSettingsStorage['get']>[0]) => extensionStorage.get(defaults),
        setActiveSettingsProfile: (name: string | undefined) => extensionStorage.setActiveProfile(name),
        removeSettingsProfile: (name: string) => extensionStorage.removeProfile(name),
    } as unknown as ChromeExtension;
    const provider = new SettingsProvider(new AppExtensionSettingsStorage(extension));

    const [profiles, activeProfile, language] = await Promise.all([
        provider.profiles(),
        provider.activeProfile(),
        provider.getSingle('language'),
    ]);
    expect(profiles).toEqual([{ name: 'Default' }, { name: 'Japanese' }]);
    expect(activeProfile).toEqual({ name: 'Default' });
    expect(language).toBe('es');
    expect((await storage.get('language')).language).toBe('es');
    expect((await storage.get(activeProfileKey))[activeProfileKey]).toBe('Default');

    await provider.removeProfile('Default');
    expect(await provider.profiles()).toEqual([{ name: 'Japanese' }]);
    await expect(provider.removeProfile('Japanese')).rejects.toThrow('last profile');
});

it('reproduces the missing Default when only the web app is updated', async () => {
    // The old extension exposes only named profiles; its implicit Default is undefined.
    const oldExtension = {
        settingsProfiles: async () => [{ name: 'Japanese' }],
        activeSettingsProfile: async () => undefined,
        getSettings: async () => ({ language: 'es' }),
    } as unknown as ChromeExtension;
    const provider = new SettingsProvider(new AppExtensionSettingsStorage(oldExtension));
    expect(await provider.profiles()).toEqual([{ name: 'Japanese' }]);
    expect(await provider.activeProfile()).toBeUndefined();
    // Settings are still present even though the new selector has no Default entry.
    expect(await provider.getSingle('language')).toBe('es');
});
