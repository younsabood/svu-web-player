import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { SvuSessionsClient } from './src/server/svu_sessions_client.js'
import { normalizeSvuAction, runSvuMetadataAction } from './src/server/svu_api_runtime.js'

let svuClient = null;
let svuQueue = Promise.resolve(); // Synchronization queue for stateful requests

const svuApiPlugin = () => ({
  name: 'svu-api-plugin',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url.startsWith('/api/svu')) return next();

      // Ensure single client instance maintains cookie session state
      if (!svuClient) svuClient = new SvuSessionsClient();

      const url = new URL(req.url, `http://${req.headers.host}`);
      const action = normalizeSvuAction(url.pathname.replace('/api/svu/', ''));

      // 1. Handle non-stateful "download" action outside the queue to avoid blocking metadata
      if (action === 'download') {
        try {
          const linkUrl = decodeURIComponent(url.searchParams.get('url'));
          const streamRes = await svuClient.client({
            method: 'get',
            url: linkUrl,
            responseType: 'stream',
            decompress: false,
            headers: { 'Accept-Encoding': 'identity' }
          });
          res.setHeader('Content-Type', streamRes.headers['content-type'] || 'application/octet-stream');
          res.setHeader('Content-Length', streamRes.headers['content-length'] || 0);
          streamRes.data.pipe(res);
          return;
        } catch (err) {
          res.statusCode = 500;
          return res.end(JSON.stringify({ success: false, error: 'Proxy Download Failed: ' + err.message }));
        }
      }

      // 2. Serialize all state-changing metadata requests
      svuQueue = svuQueue.then(async () => {
        res.setHeader('Content-Type', 'application/json');

        try {
          const handleAction = () =>
            runSvuMetadataAction({
              client: svuClient,
              action,
              searchParams: url.searchParams
            });

          // Execute action with a single retry if session expired
          let result;
          try {
            result = await handleAction();
          } catch {
            console.warn(`Action "${action}" failed, attempting full state re-init...`);
            svuClient = new SvuSessionsClient();
            result = await handleAction();
          }

          return res.end(JSON.stringify({ success: true, data: result }));

        } catch (err) {
          console.error("SVU API Error:", err);
          res.statusCode = 500;
          return res.end(JSON.stringify({ success: false, error: err.message || 'Unknown Server Error' }));
        }
      }).catch(err => {
        console.error("Queue Error:", err);
        if (!res.writableEnded) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: 'Queue Error: ' + err.message }));
        }
      });
    });
  }
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    svuApiPlugin(),
  ],
  server: {
    host: true,
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
})
