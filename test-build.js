const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing build...');

// Check if dist folder exists
if (!fs.existsSync('dist')) {
  console.error('❌ dist folder not found');
  process.exit(1);
}

// Check if CLI file exists
const cliPath = path.join('dist', 'cli.js');
if (!fs.existsSync(cliPath)) {
  console.error('❌ CLI file not found');
  process.exit(1);
}

// Check if CLI file has shebang
const cliContent = fs.readFileSync(cliPath, 'utf8');
if (!cliContent.startsWith('#!/usr/bin/env node')) {
  console.error('❌ CLI file missing shebang');
  process.exit(1);
}

// Test CLI help command
try {
  const output = execSync('node dist/cli.js --help', { encoding: 'utf8' });
  if (output.includes('git-commit-ai')) {
    console.log('✅ CLI help works');
  } else {
    console.error('❌ CLI help output incorrect');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ CLI help failed:', error.message);
  process.exit(1);
}

console.log('🎉 Build test passed!');