import { loadPricingData, summarizeIssues } from './pricing-loader.js';
import { estimate, selectRate } from './calc.js';
import { applyTranslations, t } from './i18n.js';
import { renderDonutChart } from './chart.js';

const LAST_STATE_KEY = 'orange:last_state';
const SCENARIOS_KEY = 'orange:scenarios';
const DEFAULT_CURRENCIES = ['USD', 'EUR', 'JPY', 'GBP', 'AUD', 'CAD', 'CHF', 'CNY', 'SGD', 'INR'];
const NUMBER_FORMAT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

const DEFAULT_STATE = {
  rateQuery: {
    cloud: 'Azure',
    service: '',
    edition: '',
    region: '',
    serverless: ''
  },
  inputMode: 'direct',
  inputs: {
    dbu_per_month: '',
    cluster_dbu_per_hour: '',
    hours_per_month: '',
    avg_nodes: '',
    min_nodes: '',
    max_nodes: '',
    runs_per_day: '',
    avg_run_hours: '',
    idle_hours_per_run: '',
    efficiency_factor: '',
    dbu_per_node_hour: ''
  },
  scenario: null,
  variant: null,
  sensitivity: {
    enabled: false,
    nodes_pct: 10,
    hours_pct: 10,
    efficiency_pct: 10
  },
  currency: {
    output: '',
    fx_rate: ''
  },
  rounding: {
    mode: 'half-up',
    scale: 2
  },
  theme: 'light'
};

let uiState = deepClone(DEFAULT_STATE);
let scenarioStore = {};
let pricingTable = null;
let pricingMeta = null;
let pricingIssues = [];
let isReady = false;

const banners = new Map();
let activeModal = null;
let lastFocusedElement = null;
const collapsibleRegistry = new Map();
let collapsibleSequence = 0;

const elements = {
  root: document.getElementById('appRoot'),
  bannerContainer: document.getElementById('bannerContainer'),
  versionValue: document.getElementById('versionValue'),
  currencyValue: document.getElementById('currencyValue'),
  regionValue: document.getElementById('regionValue'),
  editionValue: document.getElementById('editionValue'),
  headerSourceLink: document.getElementById('headerSourceLink'),
  headerSourceEffective: document.getElementById('headerSourceEffective'),
  serviceSelect: document.getElementById('serviceSelect'),
  serviceHint: document.getElementById('serviceHint'),
  serverlessSelect: document.getElementById('serverlessSelect'),
  serverlessHint: document.getElementById('serverlessHint'),
  modeDirectTab: document.getElementById('modeDirectTab'),
  modeDerivedTab: document.getElementById('modeDerivedTab'),
  directPanel: document.getElementById('directInputs'),
  derivedPanel: document.getElementById('derivedInputs'),
  inputControls: document.querySelectorAll('[data-field]'),
  fieldErrors: document.querySelectorAll('[data-field-error]'),
  sensitivityToggle: document.getElementById('sensitivityToggle'),
  sensitivityControls: document.querySelector('#sensitivitySection .sensitivity-controls'),
  nodesSensitivityRange: document.getElementById('nodesSensitivityRange'),
  nodesSensitivityInput: document.getElementById('nodesSensitivityInput'),
  hoursSensitivityRange: document.getElementById('hoursSensitivityRange'),
  hoursSensitivityInput: document.getElementById('hoursSensitivityInput'),
  efficiencySensitivityRange: document.getElementById('efficiencySensitivityRange'),
  efficiencySensitivityInput: document.getElementById('efficiencySensitivityInput'),
  outputCurrency: document.getElementById('outputCurrency'),
  fxRate: document.getElementById('fxRate'),
  roundingMode: document.getElementById('roundingMode'),
  roundingScale: document.getElementById('roundingScale'),
  themeToggle: document.getElementById('themeToggle'),
  scenarioName: document.getElementById('scenarioName'),
  saveScenario: document.getElementById('saveScenario'),
  loadScenario: document.getElementById('loadScenario'),
  deleteScenario: document.getElementById('deleteScenario'),
  currentScenario: document.getElementById('currentScenario'),
  copyVariant: document.getElementById('copyVariant'),
  clearVariant: document.getElementById('clearVariant'),
  baseTotal: document.getElementById('baseTotal'),
  baseDbu: document.getElementById('baseDbu'),
  baseInfra: document.getElementById('baseInfra'),
  baseScenarioMeta: document.getElementById('baseScenarioMeta'),
  variantTotal: document.getElementById('variantTotal'),
  variantDbu: document.getElementById('variantDbu'),
  variantInfra: document.getElementById('variantInfra'),
  variantScenarioMeta: document.getElementById('variantScenarioMeta'),
  deltaTotal: document.getElementById('deltaTotal'),
  deltaBreakdown: document.getElementById('deltaBreakdown'),
  variantDelta: document.getElementById('variantDelta'),
  sensitivitySummary: document.getElementById('sensitivitySummary'),
  sensitivityMin: document.getElementById('sensitivityMin'),
  sensitivityExpected: document.getElementById('sensitivityExpected'),
  sensitivityMax: document.getElementById('sensitivityMax'),
  donutChart: document.getElementById('donutChart'),
  donutLegend: document.getElementById('donutLegend'),
  warningsSection: document.getElementById('warningsSection'),
  warningList: document.getElementById('warningList'),
  helpButton: document.getElementById('helpButton'),
  helpModal: document.getElementById('helpModal'),
  scenarioModal: document.getElementById('scenarioModal'),
  scenarioList: document.getElementById('scenarioList')
};

function deepClone(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function readJson(key) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`Failed to read localStorage key ${key}`, error);
    return null;
  }
}

function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Failed to write localStorage key ${key}`, error);
  }
}

function applyCollapsibleState(entry, collapsed) {
  if (!entry) return;
  entry.section.classList.toggle('is-collapsed', collapsed);
  entry.toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  entry.body.hidden = collapsed;
}

function resolveCollapsible(target) {
  if (!target) return null;
  if (typeof target === 'string') {
    if (collapsibleRegistry.has(target)) {
      return collapsibleRegistry.get(target);
    }
    const element = document.getElementById(target);
    if (!element) return null;
    if (collapsibleRegistry.has(element)) {
      return collapsibleRegistry.get(element);
    }
    if (element.id && collapsibleRegistry.has(element.id)) {
      return collapsibleRegistry.get(element.id);
    }
    if (element.dataset?.collapsibleId && collapsibleRegistry.has(element.dataset.collapsibleId)) {
      return collapsibleRegistry.get(element.dataset.collapsibleId);
    }
    return null;
  }
  if (target instanceof HTMLElement) {
    if (collapsibleRegistry.has(target)) {
      return collapsibleRegistry.get(target);
    }
    if (target.id && collapsibleRegistry.has(target.id)) {
      return collapsibleRegistry.get(target.id);
    }
    if (target.dataset?.collapsibleId && collapsibleRegistry.has(target.dataset.collapsibleId)) {
      return collapsibleRegistry.get(target.dataset.collapsibleId);
    }
    return null;
  }
  return null;
}

function setCollapsibleState(target, collapsed) {
  const entry = resolveCollapsible(target);
  if (!entry) return;
  applyCollapsibleState(entry, collapsed);
}

function expandCollapsible(target) {
  setCollapsibleState(target, false);
}

function collapseCollapsible(target) {
  setCollapsibleState(target, true);
}

function setupCollapsibleSections() {
  document.querySelectorAll('[data-collapsible]').forEach((section) => {
    const toggle = section.querySelector('[data-section-toggle]');
    const body = section.querySelector('.section-body');
    if (!toggle || !body) return;
    const entry = { section, toggle, body };
    const id = section.id || section.dataset.collapsibleId || `collapsible-${collapsibleSequence++}`;
    section.dataset.collapsibleId = id;
    collapsibleRegistry.set(id, entry);
    collapsibleRegistry.set(section, entry);
    const shouldCollapse = section.classList.contains('is-collapsed') || section.dataset.startCollapsed === 'true';
    applyCollapsibleState(entry, shouldCollapse);
    toggle.addEventListener('click', () => {
      const nextCollapsed = !section.classList.contains('is-collapsed');
      applyCollapsibleState(entry, nextCollapsed);
    });
  });
}

function loadScenarioStore() {
  const record = readJson(SCENARIOS_KEY);
  if (!record || typeof record !== 'object') {
    return {};
  }
  return record;
}

function saveScenarioStore(store) {
  scenarioStore = store;
  writeJson(SCENARIOS_KEY, store);
}

function loadLastState() {
  const record = readJson(LAST_STATE_KEY);
  if (!record || typeof record !== 'object') {
    return null;
  }
  return record;
}

function saveLastState() {
  const payload = deepClone(uiState);
  writeJson(LAST_STATE_KEY, payload);
}

function setBanner(id, type, message) {
  if (!message) {
    banners.delete(id);
  } else {
    banners.set(id, { type, message });
  }
  renderBanners();
}

function renderBanners() {
  const container = elements.bannerContainer;
  container.innerHTML = '';
  banners.forEach((banner, id) => {
    const bannerEl = document.createElement('div');
    bannerEl.className = `banner banner-${banner.type}`;
    const icon = document.createElement('span');
    icon.className = 'banner-icon';
    icon.textContent = banner.type === 'error' ? '⚠️' : banner.type === 'warning' ? '⚠️' : banner.type === 'success' ? '✅' : 'ℹ️';
    const message = document.createElement('div');
    message.className = 'banner-message';
    message.textContent = banner.message;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'banner-close';
    close.setAttribute('aria-label', t('modal.close'));
    close.textContent = '×';
    close.addEventListener('click', () => {
      banners.delete(id);
      renderBanners();
    });
    bannerEl.appendChild(icon);
    bannerEl.appendChild(message);
    bannerEl.appendChild(close);
    container.appendChild(bannerEl);
  });
}

function isElementVisible(element) {
  return !!(
    element &&
    (element.offsetWidth || element.offsetHeight || element.getClientRects().length)
  );
}

function getFocusableElements(container) {
  if (!container) return [];
  const selector = [
    'a[href]',
    'area[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');
  return Array.from(container.querySelectorAll(selector)).filter(
    (element) =>
      !element.hasAttribute('hidden') &&
      element.getAttribute('aria-hidden') !== 'true' &&
      isElementVisible(element)
  );
}

function focusFirstElement(modal) {
  const focusable = getFocusableElements(modal);
  if (focusable.length > 0) {
    focusable[0].focus();
  } else {
    modal?.focus?.();
  }
}

function enforceModalFocus(event) {
  if (!activeModal) return;
  if (activeModal.contains(event.target)) {
    return;
  }
  const focusable = getFocusableElements(activeModal);
  const fallback = focusable[0] || activeModal;
  fallback?.focus?.();
}

function showInitialSkeleton() {
  const placeholders = [
    elements.baseTotal,
    elements.baseDbu,
    elements.baseInfra,
    elements.variantTotal,
    elements.variantDbu,
    elements.variantInfra,
    elements.deltaTotal,
    elements.deltaBreakdown,
    elements.headerSourceEffective
  ];
  placeholders.forEach((element) => {
    if (!element) return;
    element.innerHTML = '<div class="skeleton-block" style="height:20px;width:100%;"></div>';
  });
  if (elements.donutChart) {
    elements.donutChart.innerHTML = '<div class="skeleton-block" style="height:160px;width:160px;"></div>';
  }
  if (elements.donutLegend) {
    elements.donutLegend.innerHTML = '';
  }
}

function setUiDisabled(disabled) {
  const interactive = [
    elements.serviceSelect,
    elements.serverlessSelect,
    ...Array.from(elements.inputControls || []),
    elements.sensitivityToggle,
    elements.nodesSensitivityRange,
    elements.nodesSensitivityInput,
    elements.hoursSensitivityRange,
    elements.hoursSensitivityInput,
    elements.efficiencySensitivityRange,
    elements.efficiencySensitivityInput,
    elements.outputCurrency,
    elements.fxRate,
    elements.roundingMode,
    elements.roundingScale,
    elements.themeToggle,
    elements.scenarioName,
    elements.saveScenario,
    elements.loadScenario,
    elements.deleteScenario,
    elements.copyVariant,
    elements.clearVariant
  ];
  interactive.forEach((element) => {
    if (element) {
      element.disabled = disabled;
    }
  });
}

function clearSkeleton() {
  const placeholders = [
    elements.baseTotal,
    elements.baseDbu,
    elements.baseInfra,
    elements.variantTotal,
    elements.variantDbu,
    elements.variantInfra,
    elements.deltaTotal,
    elements.deltaBreakdown,
    elements.headerSourceEffective
  ];
  placeholders.forEach((element) => {
    if (!element) return;
    if (element.firstElementChild && element.firstElementChild.classList.contains('skeleton-block')) {
      element.textContent = '--';
    }
  });
  if (elements.donutChart && elements.donutChart.firstElementChild) {
    const child = elements.donutChart.firstElementChild;
    if (child.classList && child.classList.contains('skeleton-block')) {
      elements.donutChart.innerHTML = '';
    }
  }
}

function populateCurrencyOptions() {
  const select = elements.outputCurrency;
  if (!select) return;
  const baseCurrency = pricingMeta?.currency;
  const set = new Set(DEFAULT_CURRENCIES);
  if (baseCurrency) {
    set.add(baseCurrency);
  }
  select.innerHTML = '';
  Array.from(set)
    .sort()
    .forEach((currency) => {
      const option = document.createElement('option');
      option.value = currency;
      option.textContent = currency;
      select.appendChild(option);
    });
}

function computeOptions(skipField) {
  if (!pricingTable?.workloads) {
    return [];
  }
  const fields = ['service', 'edition', 'region', 'serverless'];
  const options = new Set();
  pricingTable.workloads.forEach((record) => {
    const matches = fields.every((field) => {
      if (field === skipField) {
        return true;
      }
      const targetValue = uiState.rateQuery[field];
      if (targetValue === '' || targetValue === undefined) {
        return true;
      }
      const recordValue = field === 'serverless' ? String(record.serverless) : record[field];
      return recordValue === targetValue;
    });
    if (!matches) return;
    const value = skipField === 'serverless' ? String(record.serverless) : record[skipField];
    if (value !== undefined && value !== null && value !== '') {
      options.add(value);
    }
  });
  return Array.from(options);
}

function syncSelect(select, options, formatter = (value) => value) {
  if (!select) return;
  const currentValue = select.value;
  select.innerHTML = '';
  options.forEach((optionValue) => {
    const option = document.createElement('option');
    option.value = optionValue;
    option.textContent = formatter(optionValue);
    select.appendChild(option);
  });
  if (options.includes(currentValue)) {
    select.value = currentValue;
  } else if (options.length > 0) {
    select.value = options[0];
  }
  uiState.rateQuery[select.dataset.field] = select.value;
}

function updateSelectors() {
  if (!pricingTable?.workloads) {
    return;
  }
  const serviceOptions = computeOptions('service').sort();
  syncSelect(elements.serviceSelect, serviceOptions);

  const serverlessOptions = computeOptions('serverless').sort((a, b) => String(a).localeCompare(String(b)));
  syncSelect(elements.serverlessSelect, serverlessOptions, (value) => (value === 'true' ? 'Serverless' : 'Dedicated'));
}

function parseNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return numeric;
}

function parseNumericState(state) {
  const result = {
    inputs: {},
    fxRate: parseNumber(state.currency?.fx_rate),
    roundingScale: parseNumber(state.rounding?.scale)
  };
  Object.entries(state.inputs || {}).forEach(([key, value]) => {
    result.inputs[key] = parseNumber(value);
  });
  return result;
}

function validateState(state, numeric) {
  const errors = new Map();
  const { inputs } = numeric;

  if (!state.rateQuery.service) {
    errors.set('service', t('error.selection_required'));
  }
  if (!state.rateQuery.edition) {
    errors.set('edition', t('error.selection_required'));
  }
  if (!state.rateQuery.region) {
    errors.set('region', t('error.selection_required'));
  }
  if (!state.rateQuery.serverless) {
    errors.set('serverless', t('error.selection_required'));
  }

  if (state.inputMode === 'direct') {
    if (inputs.dbu_per_month === null) {
      errors.set('dbu_per_month', t('error.number_required'));
    } else if (inputs.dbu_per_month < 0) {
      errors.set('dbu_per_month', t('error.non_negative'));
    }
  } else {
    const hasCluster = state.inputs.cluster_dbu_per_hour !== '';
    const hasNodeHour = state.inputs.dbu_per_node_hour !== '';
    if (hasCluster) {
      if (inputs.cluster_dbu_per_hour === null) {
        errors.set('cluster_dbu_per_hour', t('error.number_required'));
      } else if (inputs.cluster_dbu_per_hour < 0) {
        errors.set('cluster_dbu_per_hour', t('error.non_negative'));
      }
    }
    if (hasNodeHour) {
      if (inputs.dbu_per_node_hour === null) {
        errors.set('dbu_per_node_hour', t('error.number_required'));
      } else if (inputs.dbu_per_node_hour < 0) {
        errors.set('dbu_per_node_hour', t('error.non_negative'));
      }
    }
    if (!hasCluster && !hasNodeHour) {
      errors.set('cluster_dbu_per_hour', t('error.number_required'));
    }

    if (state.inputs.avg_nodes !== '') {
      if (inputs.avg_nodes === null) {
        errors.set('avg_nodes', t('error.number_required'));
      } else if (inputs.avg_nodes < 0) {
        errors.set('avg_nodes', t('error.non_negative'));
      }
    }

    if (state.inputs.min_nodes !== '') {
      if (inputs.min_nodes === null) {
        errors.set('min_nodes', t('error.number_required'));
      } else if (inputs.min_nodes < 0) {
        errors.set('min_nodes', t('error.non_negative'));
      }
    }

    if (state.inputs.max_nodes !== '') {
      if (inputs.max_nodes === null) {
        errors.set('max_nodes', t('error.number_required'));
      } else if (inputs.max_nodes < 0) {
        errors.set('max_nodes', t('error.non_negative'));
      }
    }

    const hasHours = state.inputs.hours_per_month !== '';
    if (hasHours) {
      if (inputs.hours_per_month === null) {
        errors.set('hours_per_month', t('error.number_required'));
      } else if (inputs.hours_per_month < 0) {
        errors.set('hours_per_month', t('error.non_negative'));
      }
    } else if (state.inputs.runs_per_day !== '' || state.inputs.avg_run_hours !== '' || state.inputs.idle_hours_per_run !== '') {
      if (inputs.runs_per_day === null) {
        errors.set('runs_per_day', t('error.number_required'));
      } else if (inputs.runs_per_day < 0) {
        errors.set('runs_per_day', t('error.non_negative'));
      }
      if (inputs.avg_run_hours === null) {
        errors.set('avg_run_hours', t('error.number_required'));
      } else if (inputs.avg_run_hours < 0) {
        errors.set('avg_run_hours', t('error.non_negative'));
      }
      if (state.inputs.idle_hours_per_run !== '' && inputs.idle_hours_per_run !== null && inputs.idle_hours_per_run < 0) {
        errors.set('idle_hours_per_run', t('error.non_negative'));
      }
    } else {
      // hours required in some form
      errors.set('hours_per_month', t('error.number_required'));
    }
  }

  if (state.inputs.efficiency_factor !== '') {
    if (inputs.efficiency_factor === null) {
      errors.set('efficiency_factor', t('error.number_required'));
    } else if (inputs.efficiency_factor < 0) {
      errors.set('efficiency_factor', t('error.non_negative'));
    }
  }

  if (numeric.roundingScale !== null) {
    if (!Number.isInteger(numeric.roundingScale)) {
      errors.set('roundingScale', t('error.number_required'));
    }
  }

  const valid = errors.size === 0;
  return { valid, errors, numeric };
}

function applyValidation(validation) {
  const fieldErrorMap = new Map();
  elements.fieldErrors.forEach((element) => {
    fieldErrorMap.set(element.dataset.fieldError, element);
  });

  elements.inputControls.forEach((element) => {
    const field = element.dataset.field;
    if (!field) return;
    const error = validation.errors.get(field);
    element.classList.toggle('is-invalid', Boolean(error));
    if (fieldErrorMap.has(field)) {
      fieldErrorMap.get(field).textContent = error || '';
    }
  });

  [elements.roundingScale].forEach((element) => {
    if (!element) return;
    const error = validation.errors.get(element.id);
    element.classList.toggle('is-invalid', Boolean(error));
  });

  const selectorMap = new Map([
    ['service', elements.serviceSelect],
    ['serverless', elements.serverlessSelect]
  ]);
  const hintMap = new Map([
    ['service', elements.serviceHint],
    ['serverless', elements.serverlessHint]
  ]);
  selectorMap.forEach((element, field) => {
    if (!element) return;
    const error = validation.errors.get(field);
    element.classList.toggle('is-invalid', Boolean(error));
    const hint = hintMap.get(field);
    if (hint) {
      hint.textContent = error || '';
    }
  });

  if (!validation.valid) {
    setBanner('input', 'error', t('banner.error.input'));
  } else {
    setBanner('input', null, null);
  }
}

function buildScenario(state, numeric) {
  const scenario = {
    rateQuery: {
      cloud: state.rateQuery.cloud || pricingTable?.workloads?.[0]?.cloud || 'Azure',
      region: state.rateQuery.region,
      edition: state.rateQuery.edition,
      service: state.rateQuery.service,
      serverless: state.rateQuery.serverless === 'true'
    },
    dbu: {}
  };

  if (state.inputMode === 'direct') {
    if (numeric.inputs.dbu_per_month !== null) {
      scenario.dbu.dbu_per_month = numeric.inputs.dbu_per_month;
    }
  } else {
    if (numeric.inputs.cluster_dbu_per_hour !== null) {
      scenario.dbu.cluster_dbu_per_hour = numeric.inputs.cluster_dbu_per_hour;
    }
    const autoscale = {};
    if (numeric.inputs.avg_nodes !== null) {
      autoscale.avg_nodes = numeric.inputs.avg_nodes;
    }
    if (numeric.inputs.min_nodes !== null) {
      autoscale.min_nodes = numeric.inputs.min_nodes;
    }
    if (numeric.inputs.max_nodes !== null) {
      autoscale.max_nodes = numeric.inputs.max_nodes;
    }
    if (Object.keys(autoscale).length > 0) {
      scenario.dbu.autoscale = autoscale;
    }
    if (numeric.inputs.dbu_per_node_hour !== null) {
      scenario.dbu.dbu_per_node_hour = numeric.inputs.dbu_per_node_hour;
    }
    if (numeric.inputs.hours_per_month !== null) {
      scenario.dbu.hours_per_month = numeric.inputs.hours_per_month;
    }
    if (numeric.inputs.runs_per_day !== null) {
      scenario.dbu.runs_per_day = numeric.inputs.runs_per_day;
    }
    if (numeric.inputs.avg_run_hours !== null) {
      scenario.dbu.avg_run_hours = numeric.inputs.avg_run_hours;
    }
    if (numeric.inputs.idle_hours_per_run !== null) {
      scenario.dbu.idle_hours_per_run = numeric.inputs.idle_hours_per_run;
    }
  }
  if (numeric.inputs.efficiency_factor !== null) {
    scenario.dbu.efficiency_factor = numeric.inputs.efficiency_factor;
  }
  return scenario;
}

function buildOptions(state, numeric) {
  const roundingScale = Number.isInteger(numeric.roundingScale) ? clamp(numeric.roundingScale, 0, 6) : state.rounding.scale;
  const rounding = {
    mode: state.rounding.mode === 'bankers' ? 'bankers' : 'half-up',
    scale: roundingScale
  };
  const currency = {
    output_currency: state.currency.output || pricingMeta?.currency || 'USD'
  };
  if (numeric.fxRate !== null && numeric.fxRate > 0) {
    currency.fx_rate = numeric.fxRate;
  }
  return { rounding, currency };
}

function formatCurrency(amount, currency) {
  if (!Number.isFinite(amount)) {
    return '--';
  }
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return formatter.format(amount);
}

function formatNumber(value) {
  if (!Number.isFinite(value)) {
    return '--';
  }
  return NUMBER_FORMAT.format(value);
}

function updateBaseResult(result, record) {
  if (!result) {
    elements.baseTotal.textContent = '--';
    elements.baseDbu.textContent = '--';
    elements.baseInfra.textContent = '--';
    elements.baseScenarioMeta.textContent = '';
    if (elements.headerSourceEffective) {
      elements.headerSourceEffective.textContent = '--';
      elements.headerSourceEffective.removeAttribute('datetime');
    }
    if (elements.headerSourceLink) {
      elements.headerSourceLink.removeAttribute('href');
      elements.headerSourceLink.setAttribute('tabindex', '-1');
      elements.headerSourceLink.setAttribute('aria-disabled', 'true');
    }
    return;
  }
  const currency = result.meta.currency;
  elements.baseTotal.textContent = formatCurrency(result.total, currency);
  elements.baseDbu.textContent = `${formatCurrency(result.dbu.cost, currency)} · ${formatNumber(result.dbu.usage_month)} DBU`;
  elements.baseInfra.textContent = formatCurrency(result.infra.cost, currency);
  if (uiState.scenario?.name) {
    elements.baseScenarioMeta.textContent = t('scenario.current', { name: uiState.scenario.name });
  } else {
    elements.baseScenarioMeta.textContent = '';
  }
  if (record) {
    if (elements.headerSourceEffective) {
      elements.headerSourceEffective.textContent = record.effective_from || '--';
      if (record.effective_from) {
        elements.headerSourceEffective.setAttribute('datetime', record.effective_from);
      } else {
        elements.headerSourceEffective.removeAttribute('datetime');
      }
    }
    if (elements.headerSourceLink) {
      elements.headerSourceLink.textContent = t('source.link');
      if (record.source) {
        elements.headerSourceLink.href = record.source;
        elements.headerSourceLink.removeAttribute('tabindex');
        elements.headerSourceLink.setAttribute('title', record.source);
        elements.headerSourceLink.setAttribute('aria-disabled', 'false');
      } else {
        elements.headerSourceLink.removeAttribute('href');
        elements.headerSourceLink.setAttribute('tabindex', '-1');
        elements.headerSourceLink.setAttribute('aria-disabled', 'true');
      }
    }
  } else {
    if (elements.headerSourceEffective) {
      elements.headerSourceEffective.textContent = '--';
      elements.headerSourceEffective.removeAttribute('datetime');
    }
    if (elements.headerSourceLink) {
      elements.headerSourceLink.removeAttribute('href');
      elements.headerSourceLink.setAttribute('tabindex', '-1');
      elements.headerSourceLink.setAttribute('aria-disabled', 'true');
      elements.headerSourceLink.textContent = t('source.link');
    }
  }
}

function describeWarnings(result) {
  if (!result?.meta?.warnings?.length) {
    return [];
  }
  return result.meta.warnings.map((code) => t(`warning.${code}`));
}

function updateWarnings(result) {
  const warnings = describeWarnings(result);
  if (!warnings.length) {
    elements.warningsSection.hidden = true;
    elements.warningList.innerHTML = '';
    collapseCollapsible('warningsSection');
    return;
  }
  elements.warningsSection.hidden = false;
  expandCollapsible('warningsSection');
  elements.warningList.innerHTML = '';
  warnings.forEach((warning) => {
    const item = document.createElement('li');
    item.textContent = warning;
    elements.warningList.appendChild(item);
  });
}

function updateDonut(result) {
  if (!elements.donutChart) return;
  if (!result) {
    renderDonutChart(elements.donutChart, elements.donutLegend, []);
    return;
  }
  const segments = [
    { label: t('results.dbu'), value: result.dbu.cost, color: '#f97316' },
    { label: t('results.infra'), value: result.infra.cost, color: '#6366f1' }
  ];
  renderDonutChart(elements.donutChart, elements.donutLegend, segments, { size: 160, thickness: 26 });
}

function computeSensitivityScenarios(baseScenario, baseOptions) {
  if (!uiState.sensitivity.enabled) {
    return null;
  }
  const nodesPct = Number(uiState.sensitivity.nodes_pct) || 0;
  const hoursPct = Number(uiState.sensitivity.hours_pct) || 0;
  const efficiencyPct = Number(uiState.sensitivity.efficiency_pct) || 0;
  const adjustments = {
    min: {
      nodes: Math.max(0, 1 - nodesPct / 100),
      hours: Math.max(0, 1 - hoursPct / 100),
      efficiency: Math.max(0, 1 - efficiencyPct / 100)
    },
    max: {
      nodes: 1 + nodesPct / 100,
      hours: 1 + hoursPct / 100,
      efficiency: 1 + efficiencyPct / 100
    }
  };

  const adjustScenario = (factor) => {
    const clone = deepClone(baseScenario);
    if (clone.dbu) {
      if (typeof clone.dbu.dbu_per_month === 'number') {
        clone.dbu.dbu_per_month = Math.max(0, clone.dbu.dbu_per_month * factor.nodes * factor.hours * factor.efficiency);
      }
      if (typeof clone.dbu.cluster_dbu_per_hour === 'number') {
        clone.dbu.cluster_dbu_per_hour = Math.max(0, clone.dbu.cluster_dbu_per_hour * factor.nodes);
      }
      if (typeof clone.dbu.hours_per_month === 'number') {
        clone.dbu.hours_per_month = Math.max(0, clone.dbu.hours_per_month * factor.hours);
      }
      if (typeof clone.dbu.runs_per_day === 'number') {
        clone.dbu.runs_per_day = Math.max(0, clone.dbu.runs_per_day * factor.hours);
      }
      if (typeof clone.dbu.avg_run_hours === 'number') {
        clone.dbu.avg_run_hours = Math.max(0, clone.dbu.avg_run_hours * factor.hours);
      }
      if (typeof clone.dbu.idle_hours_per_run === 'number') {
        clone.dbu.idle_hours_per_run = Math.max(0, clone.dbu.idle_hours_per_run * factor.hours);
      }
      if (typeof clone.dbu.efficiency_factor === 'number') {
        clone.dbu.efficiency_factor = Math.max(0, clone.dbu.efficiency_factor * factor.efficiency);
      }
      if (clone.dbu.autoscale) {
        if (typeof clone.dbu.autoscale.avg_nodes === 'number') {
          clone.dbu.autoscale.avg_nodes = Math.max(0, clone.dbu.autoscale.avg_nodes * factor.nodes);
        }
        if (typeof clone.dbu.autoscale.min_nodes === 'number') {
          clone.dbu.autoscale.min_nodes = Math.max(0, clone.dbu.autoscale.min_nodes * factor.nodes);
        }
        if (typeof clone.dbu.autoscale.max_nodes === 'number') {
          clone.dbu.autoscale.max_nodes = Math.max(0, clone.dbu.autoscale.max_nodes * factor.nodes);
        }
      }
    }
    return clone;
  };

  const minScenario = adjustScenario(adjustments.min);
  const maxScenario = adjustScenario(adjustments.max);
  return {
    min: estimate(minScenario, pricingTable, baseOptions),
    max: estimate(maxScenario, pricingTable, baseOptions)
  };
}

function updateSensitivitySummary(baseResult, baseScenario, baseOptions) {
  if (!uiState.sensitivity.enabled || !baseResult) {
    elements.sensitivitySummary.hidden = true;
    collapseCollapsible('sensitivitySummary');
    return;
  }
  const results = computeSensitivityScenarios(baseScenario, baseOptions);
  if (!results) {
    elements.sensitivitySummary.hidden = true;
    collapseCollapsible('sensitivitySummary');
    return;
  }
  const currency = baseResult.meta.currency;
  elements.sensitivitySummary.hidden = false;
  expandCollapsible('sensitivitySummary');
  elements.sensitivityMin.textContent = formatCurrency(results.min.total, currency);
  elements.sensitivityExpected.textContent = formatCurrency(baseResult.total, currency);
  elements.sensitivityMax.textContent = formatCurrency(results.max.total, currency);
}

function updateVariantCard(variantResult, baseResult) {
  if (!variantResult) {
    elements.variantTotal.textContent = '--';
    elements.variantDbu.textContent = '--';
    elements.variantInfra.textContent = '--';
    elements.deltaTotal.textContent = '--';
    elements.deltaBreakdown.textContent = '';
    elements.variantScenarioMeta.textContent = uiState.variant ? t('variant.current', { name: uiState.variant.name || t('variant.updated') }) : t('variant.empty');
    return;
  }
  const currency = variantResult.meta.currency;
  elements.variantTotal.textContent = formatCurrency(variantResult.total, currency);
  elements.variantDbu.textContent = `${formatCurrency(variantResult.dbu.cost, currency)} · ${formatNumber(variantResult.dbu.usage_month)} DBU`;
  elements.variantInfra.textContent = formatCurrency(variantResult.infra.cost, currency);
  if (uiState.variant?.name) {
    elements.variantScenarioMeta.textContent = t('variant.current', { name: uiState.variant.name });
  } else {
    elements.variantScenarioMeta.textContent = '';
  }

  if (!baseResult || baseResult.meta.currency !== variantResult.meta.currency) {
    elements.deltaTotal.textContent = '—';
    elements.deltaBreakdown.textContent = t('variant.delta.currency_mismatch');
    elements.deltaTotal.classList.remove('positive', 'negative');
    return;
  }

  const delta = variantResult.total - baseResult.total;
  const deltaDbu = variantResult.dbu.cost - baseResult.dbu.cost;
  const deltaInfra = variantResult.infra.cost - baseResult.infra.cost;
  const formattedDelta = formatCurrency(Math.abs(delta), currency);
  elements.deltaTotal.textContent = `${delta >= 0 ? '+' : '-'}${formattedDelta}`;
  elements.deltaTotal.classList.toggle('positive', delta < 0);
  elements.deltaTotal.classList.toggle('negative', delta > 0);
  elements.deltaBreakdown.textContent = `DBU ${deltaDbu >= 0 ? '+' : '-'}${formatCurrency(Math.abs(deltaDbu), currency)} · Infra ${deltaInfra >= 0 ? '+' : '-'}${formatCurrency(Math.abs(deltaInfra), currency)}`;
}

function updateScenarioMeta() {
  if (uiState.scenario?.name) {
    elements.currentScenario.textContent = t('scenario.current', { name: uiState.scenario.name });
  } else {
    elements.currentScenario.textContent = '';
  }
}

function syncSensitivityControls() {
  if (!elements.sensitivityControls) return;
  elements.sensitivityControls.classList.toggle('is-enabled', uiState.sensitivity.enabled);
  elements.sensitivityToggle.checked = uiState.sensitivity.enabled;
  elements.nodesSensitivityRange.value = uiState.sensitivity.nodes_pct;
  elements.nodesSensitivityInput.value = uiState.sensitivity.nodes_pct;
  elements.hoursSensitivityRange.value = uiState.sensitivity.hours_pct;
  elements.hoursSensitivityInput.value = uiState.sensitivity.hours_pct;
  elements.efficiencySensitivityRange.value = uiState.sensitivity.efficiency_pct;
  elements.efficiencySensitivityInput.value = uiState.sensitivity.efficiency_pct;
}

function syncTabs() {
  const isDirect = uiState.inputMode === 'direct';
  elements.modeDirectTab.classList.toggle('is-active', isDirect);
  elements.modeDirectTab.setAttribute('aria-selected', String(isDirect));
  elements.directPanel.classList.toggle('is-active', isDirect);
  elements.directPanel.hidden = !isDirect;

  elements.modeDerivedTab.classList.toggle('is-active', !isDirect);
  elements.modeDerivedTab.setAttribute('aria-selected', String(!isDirect));
  elements.derivedPanel.classList.toggle('is-active', !isDirect);
  elements.derivedPanel.hidden = isDirect;
}

function syncInputsFromState() {
  elements.inputControls.forEach((element) => {
    const field = element.dataset.field;
    if (!field) return;
    if (Object.prototype.hasOwnProperty.call(uiState.inputs, field)) {
      element.value = uiState.inputs[field] ?? '';
    }
  });
  elements.fxRate.value = uiState.currency.fx_rate ?? '';
  if (elements.outputCurrency && uiState.currency.output) {
    elements.outputCurrency.value = uiState.currency.output;
  }
  elements.roundingMode.value = uiState.rounding.mode;
  elements.roundingScale.value = uiState.rounding.scale;
  elements.themeToggle.checked = uiState.theme === 'dark';
  elements.scenarioName.value = uiState.scenario?.name ?? '';
  syncSensitivityControls();
  syncTabs();
}

function syncTheme() {
  const theme = uiState.theme === 'dark' ? 'dark' : 'light';
  document.body.classList.toggle('theme-dark', theme === 'dark');
  document.body.classList.toggle('theme-light', theme !== 'dark');
}

function updateBadges() {
  elements.versionValue.textContent = pricingMeta?.version || '--';
  const currentCurrency = uiState.currency.output || pricingMeta?.currency || '--';
  elements.currencyValue.textContent = currentCurrency;
  if (elements.regionValue) {
    const regionLabel = pricingTable?.defaults?.region?.label || pricingTable?.defaults?.region?.key || uiState.rateQuery.region || '--';
    elements.regionValue.textContent = regionLabel || '--';
  }
  if (elements.editionValue) {
    const editionLabel = pricingTable?.defaults?.edition?.label || pricingTable?.defaults?.edition?.key || uiState.rateQuery.edition || '--';
    elements.editionValue.textContent = editionLabel || '--';
  }
}

function runBaseRender() {
  if (!pricingTable) {
    return;
  }
  updateSelectors();
  syncInputsFromState();
  syncTheme();
  updateScenarioMeta();
  updateBadges();

  const numeric = parseNumericState(uiState);
  const validation = validateState(uiState, numeric);
  applyValidation(validation);

  if (!validation.valid) {
    updateBaseResult(null, null);
    updateWarnings(null);
    updateDonut(null);
    updateSensitivitySummary(null, null, null);
    updateVariantCard(null, null);
    return;
  }

  const scenario = buildScenario(uiState, numeric);
  const options = buildOptions(uiState, numeric);
  const result = estimate(scenario, pricingTable, options);
  const record = selectRate(pricingTable, scenario.rateQuery);
  updateBaseResult(result, record);
  updateWarnings(result);
  updateDonut(result);
  updateSensitivitySummary(result, scenario, options);

  if (uiState.variant) {
    const variantNumeric = parseNumericState(uiState.variant);
    const variantValidation = validateState(uiState.variant, variantNumeric);
    if (!variantValidation.valid) {
      setBanner('variant', 'error', t('banner.error.variant_invalid'));
      updateVariantCard(null, result);
    } else {
      const existing = banners.get('variant');
      if (existing && existing.type === 'error') {
        setBanner('variant', null, null);
      }
      const variantScenario = buildScenario(uiState.variant, variantNumeric);
      const variantOptions = buildOptions(uiState.variant, variantNumeric);
      const variantResult = estimate(variantScenario, pricingTable, variantOptions);
      updateVariantCard(variantResult, result);
    }
  } else {
    setBanner('variant', null, null);
    updateVariantCard(null, result);
  }
}

function setInputListener(element) {
  const field = element.dataset.field;
  if (!field) return;
  const handler = debounce((value) => {
    uiState.inputs[field] = value;
    if (!isReady) return;
    runBaseRender();
    saveLastState();
  }, 150);
  element.addEventListener('input', (event) => {
    handler(event.target.value);
  });
}

function debounce(fn, wait = 150) {
  let timeout = null;
  let lastArgs = null;
  return function debounced(...args) {
    lastArgs = args;
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      timeout = null;
      fn.apply(null, lastArgs);
    }, wait);
  };
}

function bindEvents() {
  elements.inputControls.forEach((element) => setInputListener(element));

  [elements.serviceSelect, elements.serverlessSelect].forEach((select) => {
    if (!select) return;
    select.addEventListener('change', () => {
      uiState.rateQuery[select.dataset.field] = select.value;
      if (!isReady) return;
      runBaseRender();
      saveLastState();
    });
  });

  elements.modeDirectTab.addEventListener('click', () => {
    uiState.inputMode = 'direct';
    runBaseRender();
    saveLastState();
  });
  elements.modeDerivedTab.addEventListener('click', () => {
    uiState.inputMode = 'derived';
    runBaseRender();
    saveLastState();
  });

  elements.sensitivityToggle.addEventListener('change', (event) => {
    const enabled = event.target.checked;
    uiState.sensitivity.enabled = enabled;
    if (enabled) {
      expandCollapsible('sensitivitySection');
      expandCollapsible('sensitivitySummary');
    } else {
      collapseCollapsible('sensitivitySection');
      collapseCollapsible('sensitivitySummary');
    }
    syncSensitivityControls();
    runBaseRender();
    saveLastState();
  });

  const syncSensitivityField = (range, input, key) => {
    const update = (value) => {
      const numeric = clamp(Number(value) || 0, 0, 20);
      uiState.sensitivity[key] = numeric;
      range.value = numeric;
      input.value = numeric;
      if (!isReady) return;
      runBaseRender();
      saveLastState();
    };
    range.addEventListener('input', (event) => update(event.target.value));
    input.addEventListener('input', (event) => update(event.target.value));
  };

  syncSensitivityField(elements.nodesSensitivityRange, elements.nodesSensitivityInput, 'nodes_pct');
  syncSensitivityField(elements.hoursSensitivityRange, elements.hoursSensitivityInput, 'hours_pct');
  syncSensitivityField(elements.efficiencySensitivityRange, elements.efficiencySensitivityInput, 'efficiency_pct');

  elements.outputCurrency.addEventListener('change', (event) => {
    uiState.currency.output = event.target.value;
    runBaseRender();
    saveLastState();
  });

  const fxHandler = debounce((value) => {
    uiState.currency.fx_rate = value;
    if (!isReady) return;
    runBaseRender();
    saveLastState();
  }, 150);
  elements.fxRate.addEventListener('input', (event) => fxHandler(event.target.value));

  elements.roundingMode.addEventListener('change', (event) => {
    uiState.rounding.mode = event.target.value;
    runBaseRender();
    saveLastState();
  });

  const roundingHandler = debounce((value) => {
    uiState.rounding.scale = value;
    if (!isReady) return;
    runBaseRender();
    saveLastState();
  }, 150);
  elements.roundingScale.addEventListener('input', (event) => roundingHandler(event.target.value));

  elements.themeToggle.addEventListener('change', (event) => {
    uiState.theme = event.target.checked ? 'dark' : 'light';
    syncTheme();
    saveLastState();
  });

  elements.saveScenario.addEventListener('click', handleSaveScenario);
  elements.loadScenario.addEventListener('click', () => {
    openScenarioModal();
  });
  elements.deleteScenario.addEventListener('click', handleDeleteScenario);

  elements.copyVariant.addEventListener('click', () => {
    uiState.variant = cloneScenarioState(uiState);
    uiState.variant.name = uiState.scenario?.name || t('results.base');
    setBanner('variant', 'success', t('banner.success.variant_copied'));
    runBaseRender();
    saveLastState();
  });

  elements.clearVariant.addEventListener('click', () => {
    uiState.variant = null;
    setBanner('variant', 'info', t('banner.info.variant_cleared'));
    runBaseRender();
    saveLastState();
  });

  elements.helpButton.addEventListener('click', () => openModal(elements.helpModal));
  document.querySelectorAll('[data-modal-close]').forEach((button) => {
    button.addEventListener('click', () => closeModal(button.closest('.modal')));
  });
  elements.helpModal.addEventListener('click', (event) => {
    if (event.target === event.currentTarget || event.target.dataset.modalClose !== undefined) {
      closeModal(elements.helpModal);
    }
  });
  elements.scenarioModal.addEventListener('click', (event) => {
    if (event.target === event.currentTarget || event.target.dataset.modalClose !== undefined) {
      closeModal(elements.scenarioModal);
    }
  });
  elements.scenarioList.addEventListener('click', handleScenarioListClick);

  document.addEventListener('keydown', handleKeyboardShortcuts);
  document.addEventListener('focusin', enforceModalFocus);
}

function handleKeyboardShortcuts(event) {
  if (activeModal) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal(activeModal);
      return;
    }
    if (event.key === 'Tab') {
      const focusable = getFocusableElements(activeModal);
      if (focusable.length === 0) {
        event.preventDefault();
        activeModal.focus?.();
        return;
      }
      const currentIndex = focusable.indexOf(document.activeElement);
      let nextIndex = currentIndex;
      if (event.shiftKey) {
        nextIndex = currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1;
      } else {
        nextIndex = currentIndex === focusable.length - 1 ? 0 : currentIndex + 1;
      }
      event.preventDefault();
      const next = focusable[nextIndex] || focusable[0];
      next?.focus?.();
      return;
    }
    return;
  }

  if (event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) {
    return;
  }
  const target = event.target;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
    return;
  }
  if (event.key === 's') {
    event.preventDefault();
    handleSaveScenario();
  } else if (event.key === 'l') {
    event.preventDefault();
    openScenarioModal();
  } else if (event.key === 'd') {
    event.preventDefault();
    handleDeleteScenario();
  } else if (event.key === 'Escape') {
    closeModal(elements.helpModal);
    closeModal(elements.scenarioModal);
  }
}

function cloneScenarioState(source) {
  const clone = deepClone({
    rateQuery: source.rateQuery,
    inputMode: source.inputMode,
    inputs: source.inputs,
    currency: source.currency,
    rounding: source.rounding,
    sensitivity: source.sensitivity
  });
  if (source.scenario?.name) {
    clone.name = source.scenario.name;
    clone.createdAt = source.scenario.createdAt;
  }
  return clone;
}

function handleSaveScenario() {
  const name = elements.scenarioName.value.trim();
  if (!name) {
    setBanner('scenario', 'error', t('banner.error.scenario_required'));
    return;
  }
  const store = { ...scenarioStore };
  const exists = store[name];
  if (exists && !window.confirm(t('scenario.overwrite'))) {
    return;
  }
  const entry = {
    name,
    createdAt: new Date().toISOString(),
    payload: cloneScenarioState(uiState)
  };
  store[name] = entry;
  saveScenarioStore(store);
  uiState.scenario = { name: entry.name, createdAt: entry.createdAt };
  setBanner('scenario', 'success', t('banner.success.save'));
  renderScenarioList();
  updateScenarioMeta();
  saveLastState();
}

function handleDeleteScenario() {
  const name = elements.scenarioName.value.trim();
  if (!name) {
    setBanner('scenario', 'error', t('banner.error.scenario_required'));
    return;
  }
  if (!scenarioStore[name]) {
    setBanner('scenario', 'error', t('banner.error.scenario_not_found'));
    return;
  }
  if (!window.confirm(t('scenario.delete.confirm', { name }))) {
    return;
  }
  const store = { ...scenarioStore };
  delete store[name];
  saveScenarioStore(store);
  if (uiState.scenario?.name === name) {
    uiState.scenario = null;
  }
  if (uiState.variant?.name === name) {
    uiState.variant = null;
  }
  setBanner('scenario', 'success', t('banner.success.delete'));
  renderScenarioList();
  updateScenarioMeta();
  runBaseRender();
  saveLastState();
}

function openScenarioModal() {
  renderScenarioList();
  openModal(elements.scenarioModal);
}

function renderScenarioList() {
  const list = elements.scenarioList;
  list.innerHTML = '';
  const entries = Object.values(scenarioStore || {}).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (entries.length === 0) {
    const empty = document.createElement('li');
    empty.textContent = t('scenario.load.empty');
    empty.className = 'scenario-item';
    list.appendChild(empty);
    return;
  }
  entries.forEach((entry) => {
    const item = document.createElement('li');
    item.className = 'scenario-item';
    const info = document.createElement('div');
    info.className = 'scenario-item-info';
    const name = document.createElement('span');
    name.className = 'scenario-item-name';
    name.textContent = entry.name;
    const date = document.createElement('span');
    date.className = 'scenario-item-date';
    date.textContent = new Date(entry.createdAt).toLocaleString();
    info.appendChild(name);
    info.appendChild(date);

    const actions = document.createElement('div');
    actions.className = 'scenario-item-actions';
    const loadBase = document.createElement('button');
    loadBase.type = 'button';
    loadBase.className = 'secondary-button';
    loadBase.dataset.action = 'load-base';
    loadBase.dataset.name = entry.name;
    loadBase.textContent = t('scenario.load.base');
    const loadVariant = document.createElement('button');
    loadVariant.type = 'button';
    loadVariant.className = 'secondary-button';
    loadVariant.dataset.action = 'load-variant';
    loadVariant.dataset.name = entry.name;
    loadVariant.textContent = t('scenario.load.variant');
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'ghost-button';
    remove.dataset.action = 'delete';
    remove.dataset.name = entry.name;
    remove.textContent = t('scenario.load.delete');
    actions.appendChild(loadBase);
    actions.appendChild(loadVariant);
    actions.appendChild(remove);

    item.appendChild(info);
    item.appendChild(actions);
    list.appendChild(item);
  });
}

function handleScenarioListClick(event) {
  const action = event.target.dataset.action;
  const name = event.target.dataset.name;
  if (!action || !name) {
    return;
  }
  const entry = scenarioStore[name];
  if (!entry) {
    setBanner('scenario', 'error', t('scenario.not_found'));
    return;
  }
  if (action === 'load-base') {
    applyScenarioToBase(entry);
  } else if (action === 'load-variant') {
    applyScenarioToVariant(entry);
  } else if (action === 'delete') {
    if (!window.confirm(t('scenario.delete.confirm', { name }))) {
      return;
    }
    const store = { ...scenarioStore };
    delete store[name];
    saveScenarioStore(store);
    renderScenarioList();
    if (uiState.scenario?.name === name) {
      uiState.scenario = null;
      updateScenarioMeta();
    }
    if (uiState.variant?.name === name) {
      uiState.variant = null;
      runBaseRender();
    }
    setBanner('scenario', 'success', t('banner.success.delete'));
    saveLastState();
  }
}

function applyScenarioToBase(entry) {
  const payload = entry.payload;
  if (!payload) return;
  uiState = {
    ...uiState,
    rateQuery: { ...uiState.rateQuery, ...payload.rateQuery },
    inputMode: payload.inputMode || uiState.inputMode,
    inputs: { ...uiState.inputs, ...payload.inputs },
    currency: { ...uiState.currency, ...payload.currency },
    rounding: { ...uiState.rounding, ...payload.rounding },
    sensitivity: { ...uiState.sensitivity, ...payload.sensitivity }
  };
  uiState.scenario = { name: entry.name, createdAt: entry.createdAt };
  closeModal(elements.scenarioModal);
  setBanner('scenario', 'info', t('banner.info.base_loaded'));
  runBaseRender();
  saveLastState();
}

function applyScenarioToVariant(entry) {
  if (!entry.payload) return;
  uiState.variant = cloneScenarioState(entry.payload);
  uiState.variant.name = entry.name;
  uiState.variant.createdAt = entry.createdAt;
  closeModal(elements.scenarioModal);
  setBanner('variant', 'info', t('banner.info.variant_loaded'));
  runBaseRender();
  saveLastState();
}

function openModal(modal) {
  if (!modal) return;
  if (activeModal && activeModal !== modal) {
    closeModal(activeModal);
  }
  lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  activeModal = modal;
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  modal.scrollTop = 0;
  window.requestAnimationFrame(() => {
    focusFirstElement(modal);
  });
}

function closeModal(modal) {
  if (!modal) return;
  if (modal.hidden) {
    if (activeModal === modal) {
      activeModal = null;
    }
    return;
  }
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  if (activeModal === modal) {
    activeModal = null;
    const returnFocus = lastFocusedElement;
    lastFocusedElement = null;
    if (returnFocus && typeof returnFocus.focus === 'function') {
      returnFocus.focus();
    }
  }
}

function hydrateState(saved) {
  if (!saved) {
    uiState = deepClone(DEFAULT_STATE);
    return;
  }
  uiState = deepClone(DEFAULT_STATE);
  uiState.rateQuery = { ...uiState.rateQuery, ...saved.rateQuery };
  uiState.inputMode = saved.inputMode || uiState.inputMode;
  uiState.inputs = { ...uiState.inputs, ...saved.inputs };
  uiState.currency = { ...uiState.currency, ...saved.currency };
  uiState.rounding = { ...uiState.rounding, ...saved.rounding };
  uiState.sensitivity = { ...uiState.sensitivity, ...saved.sensitivity };
  uiState.theme = saved.theme || uiState.theme;
  uiState.scenario = saved.scenario || null;
  uiState.variant = saved.variant || null;
}

async function initializeApp() {
  applyTranslations(document, 'ja');
  scenarioStore = loadScenarioStore();
  hydrateState(loadLastState());
  setupCollapsibleSections();
  bindEvents();
  populateCurrencyOptions();
  syncInputsFromState();
  syncTheme();
  showInitialSkeleton();
  setUiDisabled(true);

  try {
    const result = await loadPricingData();
    pricingTable = result.data;
    pricingMeta = result.metadata;
    pricingIssues = result.issues || [];
    const defaults = pricingTable?.defaults || {};
    if (defaults.region?.key) {
      uiState.rateQuery.region = defaults.region.key;
    }
    if (defaults.edition?.key) {
      uiState.rateQuery.edition = defaults.edition.key;
    }
    if (pricingMeta?.currency && !uiState.currency.output) {
      uiState.currency.output = pricingMeta.currency;
    }
    if (pricingMeta?.fromCache) {
      setBanner('pricing-cache', 'warning', t('banner.warn.lkg'));
    }
    if (pricingIssues.length > 0) {
      setBanner('pricing-issues', 'warning', summarizeIssues(pricingIssues));
    }
    populateCurrencyOptions();
    clearSkeleton();
    setUiDisabled(false);
    isReady = true;
    runBaseRender();
    saveLastState();
  } catch (error) {
    console.error('Failed to load pricing data', error);
    setBanner('pricing-error', 'error', `${t('banner.error.load')}\n${error.message}`);
  }
}

export { initializeApp };
export default { initializeApp };
