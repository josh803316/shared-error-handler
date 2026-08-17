import {promises as fs} from 'fs';
import path from 'path';

const distDir = path.join(path.dirname(new URL(import.meta.url).pathname), 'dist');

async function processFile(filePath) {
  if (!filePath.endsWith('.cjs')) return;

  const fileContents = await fs.readFile(filePath, 'utf8');

  const modifiedContents = fileContents

    // Imports
    .replace(/\s*import\s*\{\s*(\w+)\s*\}\s*from\s*['"](\.\/[^'"]+)['"]/g, 'import {$1} from "$2.cjs"')
    .replace(/\s*import\s*\*\s*as\s*(\w+)\s*from\s*['"](\.\/[^'"]+)['"]/g, 'import * as $1 from "$2.cjs"')

    // Exports
    .replace(/\s*export\s*\{\s*(\w+)\s*\}\s*from\s*['"](\.\/[^'"]+)['"]/g, 'export {$1} from "$2.cjs"')
    .replace(/\s*export\s*\*\s*from\s*['"](\.\/[^'"]+)['"]/g, 'export * from "$1.cjs"');

  await fs.writeFile(filePath, modifiedContents);
}

// Process files

async function processFilesInDirectory(dir) {
  const files = await fs.readdir(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);

    if ((await fs.stat(filePath)).isDirectory()) {
      await processFilesInDirectory(filePath);
    } else {
      await processFile(filePath);
    }
  }
}

await processFilesInDirectory(distDir);
