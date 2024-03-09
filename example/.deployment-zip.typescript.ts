import { defineConfig } from '../src/config.js';

export default defineConfig({
  zip: {
    output: `tmp/output-${Date.now()}.zip`,
  },
  copy: {
    outDir: `tmp/raw-${Date.now()}`,
  },
  ignore: ['.*', '*.dat', 'skip.txt', 'abc/file4.txt'],
});
