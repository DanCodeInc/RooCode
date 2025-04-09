const fs = require('fs');
const path = require('path');

// Define paths
const sourcePath = path.join(__dirname, 'src', 'services', 'code-index', 'manager.new.ts');
const targetPath = path.join(__dirname, 'src', 'services', 'code-index', 'manager.ts');
const indexPath = path.join(__dirname, 'src', 'services', 'code-index', 'index.ts');

// Check if source file exists
if (!fs.existsSync(sourcePath)) {
  console.error(`Source file not found: ${sourcePath}`);
  process.exit(1);
}

// Backup the original manager.ts file if it exists
if (fs.existsSync(targetPath)) {
  const backupPath = path.join(__dirname, 'src', 'services', 'code-index', 'manager.ts.bak');
  fs.copyFileSync(targetPath, backupPath);
  console.log(`Backed up original manager.ts to ${backupPath}`);
}

// Copy the new manager file to replace the old one
fs.copyFileSync(sourcePath, targetPath);
console.log(`Copied ${sourcePath} to ${targetPath}`);

// Update the index.ts file to use the manager.ts file instead of manager.new.ts
if (fs.existsSync(indexPath)) {
  let indexContent = fs.readFileSync(indexPath, 'utf8');
  indexContent = indexContent.replace(/from '.\/manager.new'/g, "from './manager'");
  fs.writeFileSync(indexPath, indexContent);
  console.log(`Updated ${indexPath} to use manager.ts`);
}

console.log('Done!');
