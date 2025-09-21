import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { compileSchema, formatErrors } from '../src/lib/json-schema-validator.js';
import { detectDuplicateWorkloads } from '../src/lib/workload-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaPath = path.resolve(__dirname, '../schema/pricing.schema.json');
const schemaContent = await readFile(schemaPath, 'utf8');
const schema = JSON.parse(schemaContent);

function validate(data) {
  const validator = compileSchema(schema);
  const valid = validator(data);
  return { valid, errors: validator.errors };
}

test('pricing.json matches the schema and uniqueness constraints', async () => {
  const pricingPath = path.resolve(__dirname, '../pricing.json');
  const json = JSON.parse(await readFile(pricingPath, 'utf8'));
  const result = validate(json);
  assert.equal(result.valid, true, formatErrors(result.errors));
  const duplicates = detectDuplicateWorkloads(json.workloads || []);
  assert.equal(duplicates.length, 0, duplicates.join('; '));
});

test('negative dbu_rate is rejected', () => {
  const sample = {
    version: '2024-01-01',
    currency: 'USD',
    workloads: [
      {
        cloud: 'Azure',
        region: 'eastus',
        edition: 'Premium',
        service: 'Jobs Compute',
        vm_size: 'Standard_DS3_v2',
        serverless: false,
        dbu_rate: -0.1,
        source: 'https://example.com',
        effective_from: '2024-01-01'
      }
    ]
  };
  const result = validate(sample);
  assert.equal(result.valid, false, 'Negative rates must fail validation');
});

test('missing required field causes validation error', () => {
  const sample = {
    version: '2024-01-01',
    currency: 'USD',
    workloads: [
      {
        cloud: 'Azure',
        region: 'eastus',
        edition: 'Premium',
        vm_size: 'Standard_DS3_v2',
        serverless: false,
        dbu_rate: 0.1,
        source: 'https://example.com',
        effective_from: '2024-01-01'
      }
    ]
  };
  const result = validate(sample);
  assert.equal(result.valid, false, 'Records without service should fail');
});

test('invalid effective_from date is rejected', () => {
  const sample = {
    version: '2024-01-01',
    currency: 'USD',
    workloads: [
      {
        cloud: 'Azure',
        region: 'eastus',
        edition: 'Premium',
        service: 'Jobs Compute',
        vm_size: 'Standard_DS3_v2',
        serverless: false,
        dbu_rate: 0.1,
        source: 'https://example.com',
        effective_from: '2024-13-01'
      }
    ]
  };
  const result = validate(sample);
  assert.equal(result.valid, false, 'Invalid dates must fail validation');
});

test('duplicate workloads are detected', () => {
  const sample = {
    version: '2024-01-01',
    currency: 'USD',
    workloads: [
      {
        cloud: 'Azure',
        region: 'eastus',
        edition: 'Premium',
        service: 'Jobs Compute',
        vm_size: 'Standard_DS3_v2',
        serverless: false,
        dbu_rate: 0.1,
        source: 'https://example.com',
        effective_from: '2024-01-01'
      },
      {
        cloud: 'Azure',
        region: 'eastus',
        edition: 'Premium',
        service: 'Jobs Compute',
        vm_size: 'Standard_DS3_v2',
        serverless: false,
        dbu_rate: 0.12,
        source: 'https://example.com',
        effective_from: '2024-01-01'
      }
    ]
  };
  const duplicates = detectDuplicateWorkloads(sample.workloads);
  assert.equal(duplicates.length, 1, 'Duplicates should be reported');
});
