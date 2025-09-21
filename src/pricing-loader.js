import { compileSchema, formatErrors } from './lib/json-schema-validator.js';
import { detectDuplicateWorkloads } from './lib/workload-utils.js';

const PRICING_URL = './pricing.json';
const SCHEMA_URL = 'schema/pricing.schema.json';
const LKG_STORAGE_KEY = 'orange:lastKnownGoodPricing';
const LEGACY_SOURCE_URL = 'https://www.databricks.com/product/azure-databricks-pricing';

class PricingValidationError extends Error {
  constructor(message, issues) {
    super(message);
    this.name = 'PricingValidationError';
    this.issues = issues;
  }
}

class PricingLoadError extends Error {
  constructor(message, issues) {
    super(message);
    this.name = 'PricingLoadError';
    this.issues = issues;
  }
}

let validatorPromise = null;

async function getValidator() {
  if (!validatorPromise) {
    validatorPromise = fetch(SCHEMA_URL)
      .then((response) => {
        if (!response.ok) {
          throw new PricingLoadError(`pricing schema fetch failed: ${response.status}`, [
            `schema HTTP status ${response.status}`
          ]);
        }
        return response.json();
      })
      .then((schema) => compileSchema(schema));
  }
  return validatorPromise;
}

function buildErrorMessages(errors) {
  if (!errors) {
    return [];
  }
  return errors.map((error) => {
    const path = error.instancePath || '/';
    const message = error.message || 'validation error';
    return `${path} ${message}`;
  });
}

function sanitizeRegionKey(regionKey) {
  if (typeof regionKey !== 'string') {
    return 'global';
  }
  return regionKey
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '') || 'global';
}

function convertLegacyPricing(data) {
  const version = typeof data.version === 'string' && data.version.length > 0 ? data.version : 'legacy';
  const currency = typeof data.currency === 'string' && data.currency.length > 0 ? data.currency : 'USD';
  const regions = isObject(data.regions) ? Object.keys(data.regions) : ['global'];
  const workloads = [];
  const workloadEntries = isObject(data.workloads) ? Object.entries(data.workloads) : [];

  for (const [workloadKey, workloadValue] of workloadEntries) {
    const label = isObject(workloadValue) && typeof workloadValue.label === 'string'
      ? workloadValue.label
      : workloadKey;
    const dbuRates = isObject(workloadValue) && isObject(workloadValue.dbu_rates)
      ? Object.entries(workloadValue.dbu_rates)
      : [];
    for (const [instanceKey, rate] of dbuRates) {
      const serviceName = `${label} / ${instanceKey}`;
      for (const region of regions) {
        workloads.push({
          cloud: 'Azure',
          region: sanitizeRegionKey(region),
          edition: 'Legacy',
          service: serviceName,
          serverless: false,
          dbu_rate: typeof rate === 'number' && Number.isFinite(rate) ? rate : 0,
          source: LEGACY_SOURCE_URL,
          effective_from: '1970-01-01',
          notes: `Converted from legacy pricing.json (${workloadKey}/${instanceKey})`
        });
      }
    }
  }

  if (workloads.length === 0) {
    throw new PricingValidationError('Legacy pricing.json did not contain convertible records', [
      'Legacy conversion yielded no workloads'
    ]);
  }

  console.warn('pricing.json legacy format detected — converted to normalized schema');
  return {
    version,
    currency,
    notes: 'Converted from legacy pricing.json format',
    workloads
  };
}

function isLegacyFormat(data) {
  if (!data) {
    return false;
  }
  return !Array.isArray(data.workloads);
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function storeLastKnownGood(payload) {
  try {
    const record = {
      storedAt: new Date().toISOString(),
      data: payload.data,
      metadata: payload.metadata
    };
    window.localStorage.setItem(LKG_STORAGE_KEY, JSON.stringify(record));
  } catch (error) {
    console.warn('Failed to persist last known good pricing.json to localStorage', error);
  }
}

function readLastKnownGood() {
  try {
    const raw = window.localStorage.getItem(LKG_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.data) {
      return null;
    }
    return parsed;
  } catch (error) {
    console.warn('Failed to read last known good pricing.json from localStorage', error);
    return null;
  }
}

async function fetchRemotePricing() {
  const response = await fetch(PRICING_URL, { cache: 'no-store' });
  if (!response.ok) {
    throw new PricingLoadError(`pricing.json fetch failed: ${response.status}`, [
      `pricing.json HTTP status ${response.status}`
    ]);
  }
  return response.json();
}

export async function loadPricingData() {
  const validator = await getValidator();
  let issues = [];
  let metadata = { fromCache: false, usedLegacyConversion: false };

  try {
    let rawData = await fetchRemotePricing();
    if (isLegacyFormat(rawData)) {
      rawData = convertLegacyPricing(rawData);
      metadata.usedLegacyConversion = true;
    }

    const isValid = validator(rawData);
    if (!isValid) {
      issues = buildErrorMessages(validator.errors);
      throw new PricingValidationError('pricing.json failed schema validation', issues);
    }

    const duplicateIssues = detectDuplicateWorkloads(rawData.workloads);
    if (duplicateIssues.length > 0) {
      issues = duplicateIssues;
      throw new PricingValidationError('pricing.json contains duplicate workload definitions', issues);
    }

    metadata = {
      ...metadata,
      version: rawData.version,
      currency: rawData.currency,
      storedAt: new Date().toISOString()
    };

    storeLastKnownGood({ data: rawData, metadata });

    return {
      data: rawData,
      metadata,
      issues: []
    };
  } catch (error) {
    if (error instanceof PricingValidationError || error instanceof PricingLoadError) {
      issues = error.issues || issues;
    } else {
      issues = [error.message];
    }

    const cached = readLastKnownGood();
    if (cached && cached.data) {
      return {
        data: cached.data,
        metadata: {
          ...cached.metadata,
          fromCache: true
        },
        issues
      };
    }

    throw new PricingLoadError('pricing data load failed', issues);
  }
}

export function summarizeIssues(issues) {
  if (!issues || issues.length === 0) {
    return '';
  }
  return issues.join('\n');
}

export { formatErrors };
