export const adapter = {
  id: 'vercel',
  status: 'CONDITIONAL',
  contract: { discover: true, configure: true, verify: true },
  verify(config={}) { return { status: Object.keys(config).length ? 'UNVERIFIED' : 'BLOCKED', detail: 'External adapter requires live credentials/network verification before PASS.' }; }
};
