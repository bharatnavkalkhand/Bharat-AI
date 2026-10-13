// Bolt app running in the repo checkout
// XAI_API_KEY lives in the host env
app.event('app_mention', async ({ event, say }) => {
  const { stdout } = await execFile('grok', [
    '-p', event.text, '--always-approve',
  ]);
  await say({ thread_ts: event.ts, text: stdout });
});