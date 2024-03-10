export default {
  zip: {
    output: () => {
      return `tmp/output-${Date.now()}.zip`;
    },
  },
  copy: {
    outDir: `tmp/raw-${Date.now()}`,
  },
  ignores: ['.*', '*.dat', 'skip.txt', 'abc/file4.txt'],
};
