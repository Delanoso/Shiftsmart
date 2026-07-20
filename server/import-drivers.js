import fs from 'fs/promises';
import { importDriversFromCsv } from './drivers.js';

function readArg(name) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : '';
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error(
      'Usage: node server/import-drivers.js <csv-file> [--companyId=company-1] [--companyName="Company Name"] [--append=true]',
    );
    process.exit(1);
  }

  const csvText = await fs.readFile(filePath, 'utf-8');
  const companyId = readArg('companyId');
  const companyName = readArg('companyName');
  const append = readArg('append') === 'true';

  const result = await importDriversFromCsv({
    csvText,
    companyId,
    companyName,
    replaceExisting: !append,
  });

  if (!result.ok) {
    console.error('Driver import failed:');
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(
    `Imported ${result.summary.validDrivers} drivers. Final roster size: ${result.summary.finalDriverCount}.`,
  );
  console.log(`Company: ${result.companyName} (${result.companyId})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

