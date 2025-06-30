const fs = require('fs');
const path = require('path');

const cliPath = path.join(__dirname, '..', 'dist', 'cli.js');

if (fs.existsSync(cliPath)) {
  let content = fs.readFileSync(cliPath, 'utf8');
  
  // Add shebang if not present
  if (!content.startsWith('#!/usr/bin/env node')) {
    content = '#!/usr/bin/env node\n' + content;
    fs.writeFileSync(cliPath, content);
  }
  
  // Make executable (on Unix systems)
  if (process.platform !== 'win32') {
    fs.chmodSync(cliPath, '755');
  }
  
  console.log('✅ CLI file fixed with shebang');
} else {
  console.error('❌ CLI file not found at:', cliPath);
  process.exit(1);
}