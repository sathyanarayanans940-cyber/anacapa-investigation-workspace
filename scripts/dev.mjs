import { createServer } from 'vite';
import { createLocalApi } from '../runtime/api.mjs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const api = createLocalApi(root + '.anacapa-data');
const server = await createServer({
  plugins: [
    {
      name: 'anacapa-local-data',
      configureServer(server) {
        server.middlewares.use(api);
      },
    },
  ],
});
await server.listen();
server.printUrls();
