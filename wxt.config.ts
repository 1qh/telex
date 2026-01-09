import { defineConfig } from 'wxt'

export default defineConfig({
  manifest: {
    action: { default_title: '' },
    name: 'Telex',
    permissions: ['storage', 'nativeMessaging']
  }
})
