module.exports = {
  zip: {
    output: () => {
      return `tmp/output-${Date.now()}.zip`;
    },
  },
  copy: {
    outDir: `tmp/raw-${Date.now()}`,
  },
  ignore: ['.*', '*.dat', 'skip.txt', 'abc/file4.txt'],
};
