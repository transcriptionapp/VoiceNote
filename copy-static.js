import fs from 'fs';
import path from 'path';

fs.copyFileSync(
  path.resolve('./html/recorder.html'),
  path.resolve('./dist/recorder.html')
);