import { exec } from 'child_process';

exec('npx tailwindcss -i ./css/tailwind.css -o ./public/output.css --minify', (err, stdout, stderr) => {
  if (err) {
    console.error(`❌ Tailwind build failed:\n${stderr}`);
  } else {
    console.log('✅ Tailwind CSS built to public/output.css');
  }
});