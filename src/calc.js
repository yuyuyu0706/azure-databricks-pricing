/**
 * @fileoverview Pure calculation utilities for Azure Databricks pricing simulation.
 * All functions in this module are side-effect free and deterministic.
 */

/**
 * @typedef {Object} PricingRecord
 * @property {string} cloud
 * @property {string} region
 * @property {string} edition
 * @property {string} service
 * @property {boolean} serverless
 * @property {number} dbu_rate
 * @property {string} source
 * @property {string} effective_from
 * @property {string} [notes]
 */

/**
 * @typedef {Object} PricingTable
 * @property {string} version
 * @property {string} currency
 * @property {PricingRecord[]} workloads
 */

/**
 * @typedef {Object} RateQuery
 * @property {string} cloud
 * @property {string} region
 * @property {string} edition
 * @property {string} service
 * @property {boolean} serverless
 */

/**
 * @typedef {Object} AutoscaleInput
 * @property {number} [min_nodes]
 * @property {number} [max_nodes]
 * @property {number} [avg_nodes]
 */

/**
 * @typedef {Object} DbuInput
 * @property {number} [dbu_per_month]
 * @property {number} [cluster_dbu_per_hour]
 * @property {number} [hours_per_month]
 * @property {number} [runs_per_day]
 * @property {number} [avg_run_hours]
 * @property {number} [idle_hours_per_run]
 * @property {number} [efficiency_factor]
 * @property {AutoscaleInput} [autoscale]
 * @property {number} [dbu_per_node_hour]
 * @property {number} [idle_minutes]
 * @property {number} [days_per_month]
 * @property {number} [retry_rate]
 * @property {number} [concurrency]
 */

/**
 * @typedef {Object} CurrencyOptions
 * @property {number} [fx_rate]
 * @property {string} [output_currency]
 */

/**
 * @typedef {Object} RoundingOptions
 * @property {"half-up"|"bankers"} [mode]
 * @property {number} [scale]
 */

/**
 * @typedef {Object} Scenario
 * @property {RateQuery} rateQuery
 * @property {DbuInput} dbu
 */

/**
 * @typedef {Object} DbuUsageResult
 * @property {number} usage_month
 * @property {string[]} assumptions
 * @property {WarningCode[]} warnings
 */

/**
 * @typedef {Object} DbuCostBreakdown
 * @property {number} usage_month
 * @property {number} rate
 * @property {number} cost
 */

/**
 * @typedef {Object} InfraCostBreakdown
 * @property {number} cost
 */

/**
 * @typedef {Object} EstimateResult
 * @property {DbuCostBreakdown} dbu
 * @property {InfraCostBreakdown} infra
 * @property {number} total
 * @property {{ currency: string, version: string, assumptions: string[], warnings: WarningCode[] }} meta
 */

/** @typedef {"NO_RATE_MATCH"|"MISSING_INPUT"|"NEGATIVE_OR_NAN"|"FALLBACK_AVG_NODES_USED"|"DBU_PER_NODE_HOUR_ASSUMED"} WarningCode */

const DEFAULT_ROUNDING = Object.freeze({ mode: 'half-up', scale: 2 });
const ASSUMPTION_NUMBER_FORMAT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

function formatAssumptionNumber(value) {
  if (!Number.isFinite(value)) {
    return '0';
  }
  return ASSUMPTION_NUMBER_FORMAT.format(value);
}

/**
 * Determines whether the provided value is a finite number.
 * @param {unknown} value
 * @returns {value is number}
 */
function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Clamp a number to be non-negative. Adds a NEGATIVE_OR_NAN warning if necessary.
 * @param {number} value
 * @param {WarningCode[]} warnings
 * @returns {number}
 */
function ensureNonNegative(value, warnings) {
  if (!Number.isFinite(value) || Number.isNaN(value)) {
    warnings.push('NEGATIVE_OR_NAN');
    return 0;
  }
  if (value < 0) {
    warnings.push('NEGATIVE_OR_NAN');
    return 0;
  }
  return value;
}

/**
 * Select a pricing record that matches the provided query.
 * @param {PricingTable} table
 * @param {RateQuery} query
 * @returns {PricingRecord|null}
 */
export function selectRate(table, query) {
  if (!table || !Array.isArray(table.workloads)) {
    return null;
  }
  return (
    table.workloads.find((record) =>
      record.cloud === query.cloud &&
      record.region === query.region &&
      record.edition === query.edition &&
      record.service === query.service &&
      record.serverless === query.serverless
    ) || null
  );
}

/**
 * Calculate DBU usage per month based on the provided input.
 * @param {DbuInput} input
 * @returns {DbuUsageResult}
 */
export function calcDbuUsage(input = {}) {
  const warnings = [];
  const assumptions = [];

  let efficiency = 1;
  if (isFiniteNumber(input.efficiency_factor)) {
    efficiency = ensureNonNegative(input.efficiency_factor, warnings);
    if (efficiency !== 1) {
      assumptions.push(`Applied efficiency factor ${formatAssumptionNumber(efficiency)}`);
    }
  } else if (input.efficiency_factor !== undefined) {
    warnings.push('NEGATIVE_OR_NAN');
  }

  if (isFiniteNumber(input.dbu_per_month)) {
    const direct = ensureNonNegative(input.dbu_per_month, warnings);
    const usage = direct * efficiency;
    if (efficiency !== 1) {
      assumptions.push(
        `Direct DBU input ${formatAssumptionNumber(direct)} × efficiency ${formatAssumptionNumber(efficiency)} = ${formatAssumptionNumber(usage)}`
      );
    } else {
      assumptions.push(`Direct DBU input ${formatAssumptionNumber(direct)}`);
    }
    return { usage_month: usage, assumptions, warnings };
  }

  let clusterDbuPerHour = null;
  if (isFiniteNumber(input.cluster_dbu_per_hour)) {
    clusterDbuPerHour = ensureNonNegative(input.cluster_dbu_per_hour, warnings);
    assumptions.push(`cluster_dbu_per_hour input ${formatAssumptionNumber(clusterDbuPerHour)}`);
  }

  if (clusterDbuPerHour === null) {
    const autoscale = input.autoscale || {};
    let avgNodes = null;
    if (isFiniteNumber(autoscale.avg_nodes)) {
      avgNodes = ensureNonNegative(autoscale.avg_nodes, warnings);
      assumptions.push(`Using avg_nodes ${formatAssumptionNumber(avgNodes)}`);
    } else if (isFiniteNumber(autoscale.min_nodes) && isFiniteNumber(autoscale.max_nodes)) {
      const minNodes = ensureNonNegative(autoscale.min_nodes, warnings);
      const maxNodes = ensureNonNegative(autoscale.max_nodes, warnings);
      avgNodes = (minNodes + maxNodes) / 2;
      assumptions.push(
        `avg_nodes not provided; using (min+max)/2 = ${formatAssumptionNumber(avgNodes)}`
      );
      warnings.push('FALLBACK_AVG_NODES_USED');
    }

    if (avgNodes === null) {
      warnings.push('MISSING_INPUT');
      return { usage_month: 0, assumptions, warnings };
    }

    let dbuPerNodeHour = null;
    if (isFiniteNumber(input.dbu_per_node_hour)) {
      dbuPerNodeHour = ensureNonNegative(input.dbu_per_node_hour, warnings);
    } else if (input.dbu_per_node_hour !== undefined) {
      warnings.push('NEGATIVE_OR_NAN');
    }

    if (!Number.isFinite(dbuPerNodeHour) || dbuPerNodeHour === null) {
      dbuPerNodeHour = 1;
      warnings.push('DBU_PER_NODE_HOUR_ASSUMED');
      assumptions.push('dbu_per_node_hour not provided; assuming 1');
    }

    clusterDbuPerHour = avgNodes * dbuPerNodeHour;
    assumptions.push(
      `cluster_dbu_per_hour derived: avg_nodes ${formatAssumptionNumber(avgNodes)} × dbu_per_node_hour ${formatAssumptionNumber(
        dbuPerNodeHour
      )} = ${formatAssumptionNumber(clusterDbuPerHour)}`
    );
  }

  if (!Number.isFinite(clusterDbuPerHour)) {
    warnings.push('MISSING_INPUT');
    return { usage_month: 0, assumptions, warnings };
  }

  let hoursPerMonth = null;
  if (isFiniteNumber(input.hours_per_month)) {
    hoursPerMonth = ensureNonNegative(input.hours_per_month, warnings);
    assumptions.push(`hours_per_month input ${formatAssumptionNumber(hoursPerMonth)}`);
  } else if (isFiniteNumber(input.runs_per_day) && isFiniteNumber(input.avg_run_hours)) {
    const runsPerDay = ensureNonNegative(input.runs_per_day, warnings);
    const avgRunHours = ensureNonNegative(input.avg_run_hours, warnings);
    let idlePerRun = isFiniteNumber(input.idle_hours_per_run)
      ? ensureNonNegative(input.idle_hours_per_run, warnings)
      : 0;

    let daysPerMonth = 30;
    let usedDefaultDays = true;
    if (isFiniteNumber(input.days_per_month)) {
      daysPerMonth = ensureNonNegative(input.days_per_month, warnings);
      usedDefaultDays = false;
    } else if (input.days_per_month !== undefined) {
      warnings.push('NEGATIVE_OR_NAN');
    }

    if (usedDefaultDays) {
      assumptions.push('days_per_month not provided; using default 30');
    } else {
      assumptions.push(`days_per_month input ${formatAssumptionNumber(daysPerMonth)}`);
    }

    let idleCapHours = null;
    if (isFiniteNumber(input.idle_minutes)) {
      const idleMinutes = ensureNonNegative(input.idle_minutes, warnings);
      if (idleMinutes > 0) {
        idleCapHours = idleMinutes / 60;
        assumptions.push(`Idle termination configured at ${formatAssumptionNumber(idleMinutes)} minutes`);
      } else {
        assumptions.push('Idle termination disabled (0 minutes)');
      }
    } else if (input.idle_minutes !== undefined) {
      warnings.push('NEGATIVE_OR_NAN');
    }

    if (idleCapHours !== null && idlePerRun > idleCapHours) {
      idlePerRun = idleCapHours;
      assumptions.push(`Idle hours per run capped to ${formatAssumptionNumber(idlePerRun)} by idle_minutes`);
    }

    const activeHours = runsPerDay * daysPerMonth * avgRunHours;
    const idleHours = runsPerDay * daysPerMonth * idlePerRun;
    assumptions.push(
      `Active hours/month: runs_per_day ${formatAssumptionNumber(runsPerDay)} × days_per_month ${formatAssumptionNumber(
        daysPerMonth
      )} × avg_run_hours ${formatAssumptionNumber(avgRunHours)} = ${formatAssumptionNumber(activeHours)}`
    );
    if (idlePerRun > 0) {
      assumptions.push(
        `Idle hours/month: runs_per_day ${formatAssumptionNumber(runsPerDay)} × days_per_month ${formatAssumptionNumber(
          daysPerMonth
        )} × idle_hours_per_run ${formatAssumptionNumber(idlePerRun)} = ${formatAssumptionNumber(idleHours)}`
      );
    }
    hoursPerMonth = activeHours + idleHours;
    assumptions.push(`Total hours/month ${formatAssumptionNumber(hoursPerMonth)}`);
  }

  if (!isFiniteNumber(hoursPerMonth)) {
    warnings.push('MISSING_INPUT');
    return { usage_month: 0, assumptions, warnings };
  }

  const baseUsage = ensureNonNegative(clusterDbuPerHour * hoursPerMonth, warnings);
  assumptions.push(
    `Monthly DBU before efficiency: cluster_dbu_per_hour ${formatAssumptionNumber(clusterDbuPerHour)} × hours_per_month ${formatAssumptionNumber(
      hoursPerMonth
    )} = ${formatAssumptionNumber(baseUsage)}`
  );

  let usage = baseUsage;
  if (efficiency !== 1) {
    usage = baseUsage * efficiency;
    assumptions.push(`Applying efficiency ${formatAssumptionNumber(efficiency)} → ${formatAssumptionNumber(usage)}`);
  }

  return { usage_month: usage, assumptions, warnings };
}

/**
 * Calculate DBU cost with rounding.
 * @param {number} dbuUsage
 * @param {number} dbuRate
 * @param {RoundingOptions} [rounding]
 * @returns {number}
 */
export function calcDbuCost(dbuUsage, dbuRate, rounding = DEFAULT_ROUNDING) {
  const factor = Math.pow(10, rounding?.scale ?? DEFAULT_ROUNDING.scale);
  const mode = rounding?.mode ?? DEFAULT_ROUNDING.mode;
  const raw = dbuUsage * dbuRate;
  if (!Number.isFinite(raw)) {
    return 0;
  }
  if (mode === 'bankers') {
    const scaled = raw * factor;
    const floor = Math.floor(scaled);
    const fractional = scaled - floor;
    if (Math.abs(fractional - 0.5) <= 1e-10) {
      const upper = floor + 1;
      const even = floor % 2 === 0 ? floor : upper % 2 === 0 ? upper : floor;
      return even / factor;
    }
    return Math.round(scaled) / factor;
  }
  return Math.round(raw * factor) / factor;
}

/**
 * Placeholder for infrastructure costs.
 * @returns {number}
 */
export function calcInfraCost() {
  return 0;
}

/**
 * Aggregate estimation for the provided scenario.
 * @param {Scenario} scenario
 * @param {PricingTable} pricing
 * @param {{ rounding?: RoundingOptions, currency?: CurrencyOptions }} [opts]
 * @returns {EstimateResult}
 */
export function estimate(scenario, pricing, opts = {}) {
  const usageResult = calcDbuUsage(scenario?.dbu || {});
  const warnings = new Set(usageResult.warnings);
  const assumptions = [...usageResult.assumptions];

  const record = scenario?.rateQuery ? selectRate(pricing, scenario.rateQuery) : null;
  if (!record) {
    warnings.add('NO_RATE_MATCH');
  }

  const rounding = opts.rounding || DEFAULT_ROUNDING;
  const currencyOpts = opts.currency || {};

  const baseRate = record?.dbu_rate ?? 0;
  let effectiveRate = baseRate;
  if (isFiniteNumber(currencyOpts.fx_rate)) {
    effectiveRate = baseRate * currencyOpts.fx_rate;
    assumptions.push(`Applied FX rate ${currencyOpts.fx_rate}`);
  }

  const dbuCost = calcDbuCost(usageResult.usage_month, effectiveRate, rounding);
  const infraCost = calcInfraCost();
  const total = dbuCost + infraCost;

  const outputCurrency = currencyOpts.output_currency || pricing?.currency || 'USD';
  const metaWarnings = Array.from(warnings);

  return {
    dbu: {
      usage_month: usageResult.usage_month,
      rate: effectiveRate,
      cost: dbuCost
    },
    infra: { cost: infraCost },
    total,
    meta: {
      currency: outputCurrency,
      version: pricing?.version || 'unknown',
      assumptions,
      warnings: metaWarnings
    }
  };
}

export default {
  selectRate,
  calcDbuUsage,
  calcDbuCost,
  calcInfraCost,
  estimate
};
