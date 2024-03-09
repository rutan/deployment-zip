import { defineConfig } from '../src/config.js';
import { readStreamText } from '../src/utils.js';

export default defineConfig({
  zip: {
    output: `tmp/output-${Date.now()}.zip`,
  },
  copy: {
    outDir: `tmp/raw-${Date.now()}`,
  },
  ignores: ['.*', '*.dat', 'skip.txt', 'abc/file4.txt'],
  plugins: [
    {
      transform: async ({ name, stream }) => {
        if (!name.endsWith('.md')) return;

        const data = await readStreamText(stream);
        return `${data}\n\nADDED BY PLUGIN!`;
      },
    },
  ],
});
