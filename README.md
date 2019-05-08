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
module.exports = {
  // output file name
  output: 'output.zip',

  // ignore file (format: .gitignore)
  ignore: [
    'hoge.jpg',
    'fuga*',
    'piyo/',
    '!piyo/poyo.png'
  ]
};
```
