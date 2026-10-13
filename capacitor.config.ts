import type { CapacitorConfig } from '@capacitor/cli'
const config: CapacitorConfig = {
  appId: 'io.hdsinterlude.android',
  appName: 'HDS',
  webDir: 'dist',
  android: { allowMixedContent: false },
  server: { androidScheme: 'https' },
}
export default config
