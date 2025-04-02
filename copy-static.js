const fs = require('fs');
const path = require('path');

fs.copyFileSync(
  path.resolve('./html/recorder.html'),
  path.resolve('./dist/recorder.html')
);