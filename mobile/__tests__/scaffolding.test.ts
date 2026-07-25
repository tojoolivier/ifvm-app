import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('Scaffolding Configuration', () => {
  const mobileDir = join(__dirname, '..');

  test('package.json has correct name and slug', () => {
    const packageJson = JSON.parse(
      readFileSync(join(mobileDir, 'package.json'), 'utf-8')
    );
    
    expect(packageJson.name).toBe('ifvm-mobile');
    expect(packageJson.expo?.slug).toBe('ifvm-mobile');
    expect(packageJson.expo?.name).toBe('IFVM Mobile');
  });

  test('tsconfig.json has strict mode enabled', () => {
    const tsconfig = JSON.parse(
      readFileSync(join(mobileDir, 'tsconfig.json'), 'utf-8')
    );
    
    expect(tsconfig.compilerOptions?.strict).toBe(true);
  });

  test('eas.json has preview and production profiles', () => {
    const easConfig = JSON.parse(
      readFileSync(join(mobileDir, 'eas.json'), 'utf-8')
    );
    
    expect(easConfig.build?.preview).toBeDefined();
    expect(easConfig.build?.production).toBeDefined();
    expect(easConfig.build?.preview?.android?.buildType).toBe('apk');
  });

  test('NativeWind configuration files exist', () => {
    expect(existsSync(join(mobileDir, 'tailwind.config.js'))).toBe(true);
    expect(existsSync(join(mobileDir, 'babel.config.js'))).toBe(true);
    expect(existsSync(join(mobileDir, 'metro.config.js'))).toBe(true);
    expect(existsSync(join(mobileDir, 'nativewind-env.d.ts'))).toBe(true);
  });

  test('App structure has tabs and auth groups', () => {
    const appDir = join(mobileDir, 'src', 'app');
    
    expect(existsSync(join(appDir, '_layout.tsx'))).toBe(true);
    expect(existsSync(join(appDir, '(tabs)', '_layout.tsx'))).toBe(true);
    expect(existsSync(join(appDir, '(tabs)', 'index.tsx'))).toBe(true);
    expect(existsSync(join(appDir, '(tabs)', 'prospection.tsx'))).toBe(true);
    expect(existsSync(join(appDir, '(tabs)', 'profile.tsx'))).toBe(true);
    expect(existsSync(join(appDir, '(auth)', '_layout.tsx'))).toBe(true);
    expect(existsSync(join(appDir, '(auth)', 'login.tsx'))).toBe(true);
  });
});
