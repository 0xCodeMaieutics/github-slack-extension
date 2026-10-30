import preact from '@preact/preset-vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  vite: () => ({ plugins: [preact()] }),
  manifest: {
    name: 'GitHub → Slack Review Requests',
    description: 'Request a pull request review from colleagues on Slack, straight from GitHub.',
    permissions: ['storage'],
    host_permissions: ['https://slack.com/*'],
    action: { default_title: 'Slack review request settings' },
  },
});
