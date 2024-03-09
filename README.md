# @rutan/deployment-zip

## How to use

```bash
$ npm install -g @rutan/deployment-zip
```

```bash
$ deployment-zip ./game
```

## Config

use `./.deployment-zip.js`

```
export default {
  // .gitignore style
  ignore: [
    '.env'
  ],

  // .gitignore file
  ignoreFile: '.deployment-zip-ignore'

  // mode zip config
  zip: {
    output: 'output.zip'
  },

  // mode copy config
  copy: {
    outDir: 'outputDir',
  }
};
```
