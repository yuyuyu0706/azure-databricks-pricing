import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { compileSchema, formatErrors } from '../src/lib/json-schema-validator.js';
import { detectDuplicateWorkloads } from '../src/lib/workload-utils.js';

function resolveRelative(relativePath) {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(currentDir, '..', relativePath);
}

async function main() {
  try {
    const schemaPath = resolveRelative('schema/pricing.schema.json');
    const dataPath = resolveRelative('pricing.json');

    const [schemaRaw, dataRaw] = await Promise.all([
      readFile(schemaPath, 'utf8'),
      readFile(dataPath, 'utf8')
    ]);

    const schema = JSON.parse(schemaRaw);
    const data = JSON.parse(dataRaw);

    const validator = compileSchema(schema);
    if (!validator(data)) {
      console.error('pricing.json failed schema validation');
      console.error(formatErrors(validator.errors));
      process.exit(1);
    }

    const duplicates = detectDuplicateWorkloads(data.workloads || []);
    if (duplicates.length > 0) {
      console.error('pricing.json contains duplicate workload definitions');
      duplicates.forEach((issue) => console.error(`- ${issue}`));
      process.exit(1);
    }

    console.log('pricing.json validation passed');
  } catch (error) {
    console.error('Unable to validate pricing.json');
    console.error(error);
    process.exit(1);
  }
}

await main();
