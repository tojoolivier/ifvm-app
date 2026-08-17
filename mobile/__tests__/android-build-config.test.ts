import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Parc d'appareils cible (terrain IFVM).
 *
 * Ce tableau est la specification executable du build Android : chaque appareil
 * qu'on s'engage a supporter y figure avec l'ABI que son userland Android
 * expose et son niveau d'API. Les tests plus bas verifient que la config Expo
 * couvre bien chaque ligne — ajouter un appareil ici fait echouer le build tant
 * que app.json n'a pas ete mis a jour.
 *
 * Rappel : l'ABI depend de l'OS installe, pas seulement du CPU. Le Unisoc
 * SC9863A est un octa-core Cortex-A55 (ARMv8, 64-bit capable), mais les ROM
 * Android Go 2 Go de RAM livrees sur ces appareils tournent en userland 32-bit
 * et n'exposent donc que armeabi-v7a. Un APK qui ne contient que des .so
 * arm64-v8a s'y installe en echec silencieux ("application non installee").
 */
const SUPPORTED_DEVICES = [
  {
    model: 'itel A631L (A49 Play)',
    soc: 'Unisoc SC9863A',
    androidApi: 31, // Android 12 (Go edition)
    abi: 'armeabi-v7a',
  },
  {
    model: 'Appareils Android 64-bit courants',
    soc: 'ARMv8 64-bit',
    androidApi: 31,
    abi: 'arm64-v8a',
  },
  {
    model: 'Emulateur Android (CI / dev)',
    soc: 'x86_64',
    androidApi: 31,
    abi: 'x86_64',
  },
] as const;

type ExpoConfig = {
  expo: {
    plugins: (string | [string, Record<string, unknown>])[];
  };
};

function readBuildProperties(): { buildArchs?: string[]; minSdkVersion?: number } {
  const appJson: ExpoConfig = JSON.parse(
    readFileSync(join(__dirname, '..', 'app.json'), 'utf-8')
  );

  const plugin = appJson.expo.plugins.find(
    (entry): entry is [string, Record<string, unknown>] =>
      Array.isArray(entry) && entry[0] === 'expo-build-properties'
  );

  if (!plugin) {
    throw new Error('Le plugin expo-build-properties est absent de app.json');
  }

  return (plugin[1].android ?? {}) as { buildArchs?: string[]; minSdkVersion?: number };
}

describe('Configuration du build Android', () => {
  test.each(SUPPORTED_DEVICES)(
    "buildArchs contient l'ABI $abi requise par $model",
    ({ abi }) => {
      const { buildArchs } = readBuildProperties();

      expect(buildArchs).toContain(abi);
    }
  );

  test('buildArchs ne contient que des ABI Android valides', () => {
    const { buildArchs } = readBuildProperties();
    const validAbis = ['armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64'];

    expect(buildArchs).toBeDefined();
    expect(buildArchs!.length).toBeGreaterThan(0);
    for (const abi of buildArchs!) {
      expect(validAbis).toContain(abi);
    }
  });

  test("minSdkVersion, s'il est force, reste sous le plus ancien appareil supporte", () => {
    const { minSdkVersion } = readBuildProperties();
    const oldestApi = Math.min(...SUPPORTED_DEVICES.map((device) => device.androidApi));

    if (minSdkVersion !== undefined) {
      expect(minSdkVersion).toBeLessThanOrEqual(oldestApi);
    }
  });
});
