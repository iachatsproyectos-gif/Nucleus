const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const dest = path.join(__dirname, '..', 'Nucleus-debug.apk');

if (!fs.existsSync(src)) {
  console.error('No se encontró el APK compilado:', src);
  process.exit(1);
}

fs.copyFileSync(src, dest);
console.log('APK listo:', dest);
