import test from 'node:test';
import assert from 'node:assert/strict';

import { calcDbuUsage, calcDbuCost, estimate } from '../src/calc.js';

const samplePricing = {
  version: 'v1',
  currency: 'USD',
  workloads: [
    {
      cloud: 'Azure',
      region: 'eastus',
      edition: 'Premium',
      service: 'Jobs Compute',
      serverless: false,
      dbu_rate: 0.15,
      source: 'https://example.com',
      effective_from: '2024-01-01'
    }
  ]
};

test('direct DBU input produces expected DBU cost', () => {
  const scenario = {
    rateQuery: {
      cloud: 'Azure',
      region: 'eastus',
      edition: 'Premium',
      service: 'Jobs Compute',
      serverless: false
    },
    dbu: {
      dbu_per_month: 1200
    }
  };

  const result = estimate(scenario, samplePricing);
  assert.equal(result.dbu.usage_month, 1200);
  assert.equal(result.dbu.rate, 0.15);
  assert.equal(result.dbu.cost, 180);
  assert.equal(result.total, 180);
  assert.deepEqual(result.meta.warnings, []);
});

test('derived input using cluster DBU per hour matches expectation', () => {
  const usage = calcDbuUsage({
    cluster_dbu_per_hour: 10,
    hours_per_month: 100
  });
  assert.equal(usage.usage_month, 1000);
  const cost = calcDbuCost(usage.usage_month, 0.15);
  assert.equal(cost, 150);
});

test('autoscale fallback derives DBU usage from node configuration', () => {
  const usage = calcDbuUsage({
    autoscale: {
      min_nodes: 2,
      max_nodes: 6
    },
    dbu_per_node_hour: 1.5,
    runs_per_day: 2,
    avg_run_hours: 2,
    idle_hours_per_run: 0.5
  });

  assert.equal(usage.usage_month, 900);
  assert.ok(usage.assumptions.some((item) => item.includes('(min+max)/2')));
  assert.ok(usage.assumptions.some((item) => item.includes('Active hours/month') && item.includes('120')));
  assert.ok(usage.warnings.includes('FALLBACK_AVG_NODES_USED'));
});

test('efficiency factor reduces usage accordingly', () => {
  const usage = calcDbuUsage({
    dbu_per_month: 1000,
    efficiency_factor: 0.8
  });
  assert.equal(usage.usage_month, 800);
});

test('idle termination caps idle hours per run', () => {
  const usage = calcDbuUsage({
    autoscale: { min_nodes: 2, max_nodes: 6 },
    dbu_per_node_hour: 1.2,
    runs_per_day: 2,
    avg_run_hours: 2,
    idle_hours_per_run: 1,
    idle_minutes: 15
  });

  assert.equal(usage.usage_month, 648);
  assert.ok(usage.assumptions.some((item) => item.includes('capped') && item.includes('idle_minutes')));
});

test('dbu per node hour fallback applies when missing', () => {
  const usage = calcDbuUsage({
    autoscale: { avg_nodes: 3 },
    runs_per_day: 1,
    avg_run_hours: 1
  });

  assert.equal(usage.usage_month, 90);
  assert.ok(usage.warnings.includes('DBU_PER_NODE_HOUR_ASSUMED'));
  assert.ok(usage.assumptions.some((item) => item.includes('dbu_per_node_hour not provided')));
});

test('custom days per month adjusts active hours', () => {
  const usage = calcDbuUsage({
    autoscale: { min_nodes: 1, max_nodes: 3 },
    dbu_per_node_hour: 1,
    runs_per_day: 2,
    avg_run_hours: 2,
    days_per_month: 31
  });

  assert.equal(usage.usage_month, 248);
  assert.ok(usage.assumptions.some((item) => item.includes('days_per_month input')));
});

test('missing rate surfaces warning but does not throw', () => {
  const scenario = {
    rateQuery: {
      cloud: 'Azure',
      region: 'westus',
      edition: 'Premium',
      service: 'Jobs Compute',
      serverless: false
    },
    dbu: {
      dbu_per_month: 100
    }
  };

  const result = estimate(scenario, samplePricing);
  assert.equal(result.dbu.rate, 0);
  assert.equal(result.dbu.cost, 0);
  assert.ok(result.meta.warnings.includes('NO_RATE_MATCH'));
});
