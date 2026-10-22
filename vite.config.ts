import {defineConfig} from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import {tanstackStart} from '@tanstack/react-start/plugin/vite';
import {nitro} from 'nitro/vite';
import viteReact from '@vitejs/plugin-react';

// Portable counterpart of the original static TanStack Start app.
// No Macaly editor plugins and no server-side access to personal user records.
export default defineConfig({
  plugins: [
    tsconfigPaths({projects:['./tsconfig.json']}),
    tanstackStart({prerender:{enabled:true,autoSubfolderIndex:true,autoStaticPathsDiscovery:true,crawlLinks:false,failOnError:true}}),
    nitro(),
    viteReact(),
  ],
});
