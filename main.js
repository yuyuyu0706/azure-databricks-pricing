import { loadPricingData, summarizeIssues } from './src/pricing-loader.js';
import { estimate } from './src/calc.js';

const bannerContainer = document.getElementById('bannerContainer');
const versionBadge = document.getElementById('pricingVersion');
const currencyBadge = document.getElementById('pricingCurrency');
const serviceSelect = document.getElementById('serviceSelect');
const editionSelect = document.getElementById('editionSelect');
const regionSelect = document.getElementById('regionSelect');
const serverlessSelect = document.getElementById('serverlessSelect');
const dbuInput = document.getElementById('dbuInput');
const selectedRateEl = document.getElementById('selectedRate');
const effectiveDateEl = document.getElementById('effectiveDate');
const sourceLinkEl = document.getElementById('sourceLink');
const recordNotesEl = document.getElementById('recordNotes');
const totalPriceEl = document.getElementById('totalPrice');
const breakdownEl = document.getElementById('breakdownText');
const calcBtn = document.getElementById('calcBtn');
const resetBtn = document.getElementById('resetBtn');

const UI_STATE_KEY = 'orange:ui-state';

let pricingData = null;
let currentRecord = null;
let metadata = null;

const filterState = {
  service: '',
  edition: '',
  region: '',
  serverless: ''
};

function saveUiState() {
  try {
    const payload = {
      filters: filterState,
      dbuUsage: Number.parseFloat(dbuInput.value) || 0
    };
    window.localStorage.setItem(UI_STATE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('failed to store UI state', error);
  }
}

function restoreUiState() {
  try {
    const raw = window.localStorage.getItem(UI_STATE_KEY);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw);
    if (parsed && parsed.filters) {
      filterState.service = parsed.filters.service || '';
      filterState.edition = parsed.filters.edition || '';
      filterState.region = parsed.filters.region || '';
      filterState.serverless = parsed.filters.serverless || '';
    }
    if (parsed && typeof parsed.dbuUsage === 'number' && Number.isFinite(parsed.dbuUsage)) {
      dbuInput.value = parsed.dbuUsage;
    }
  } catch (error) {
    console.warn('failed to restore UI state', error);
  }
}

function formatCurrency(amount, currencyOverride) {
  const currency = currencyOverride || metadata?.currency || 'USD';
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return formatter.format(amount);
}

function setBadgeText(element, label, value) {
  if (!element) return;
  if (!value) {
    element.textContent = `${label} --`;
    return;
  }
  element.textContent = `${label} ${value}`;
}

function clearBanners() {
  bannerContainer.innerHTML = '';
}

function createBanner(type, message) {
  const banner = document.createElement('div');
  banner.className = `banner banner-${type}`;
  const text = document.createElement('p');
  text.textContent = message;
  banner.appendChild(text);
  bannerContainer.appendChild(banner);
}

function showError(message) {
  clearBanners();
  createBanner('error', message);
}

function disableInputs(disabled) {
  [serviceSelect, editionSelect, regionSelect, serverlessSelect, dbuInput, calcBtn, resetBtn].forEach((element) => {
    if (element) {
      element.disabled = disabled;
    }
  });
}

function computeOptions(workloads, skipField) {
  return workloads.reduce((set, record) => {
    if (!matchesFilters(record, skipField)) {
      return set;
    }
    const value = fieldValue(record, skipField);
    if (value !== undefined && value !== null) {
      set.add(value);
    }
    return set;
  }, new Set());
}

function matchesFilters(record, skipField = null) {
  return Object.entries(filterState).every(([field, value]) => {
    if (field === skipField) {
      return true;
    }
    if (!value && value !== false) {
      return true;
    }
    if (field === 'serverless') {
      return String(record.serverless) === value;
    }
    return record[field] === value;
  });
}

function fieldValue(record, field) {
  if (field === 'serverless') {
    return String(record.serverless);
  }
  return record[field];
}

function populateSelect(selectElement, options, formatter) {
  if (!selectElement) return;
  const currentValue = selectElement.value;
  selectElement.innerHTML = '';
  options.forEach((option) => {
    const opt = document.createElement('option');
    opt.value = option;
    opt.textContent = formatter(option);
    selectElement.appendChild(opt);
  });
  if (options.includes(currentValue)) {
    selectElement.value = currentValue;
  } else if (options.length > 0) {
    selectElement.value = options[0];
    filterState[selectElement.dataset.field] = options[0];
  }
}

function refreshSelectors() {
  const workloads = pricingData.workloads;

  const serviceOptions = Array.from(computeOptions(workloads, 'service')).sort();
  populateSelect(serviceSelect, serviceOptions, (value) => value);
  filterState.service = serviceSelect.value;

  const editionOptions = Array.from(computeOptions(workloads, 'edition')).sort();
  populateSelect(editionSelect, editionOptions, (value) => value);
  filterState.edition = editionSelect.value;

  const regionOptions = Array.from(computeOptions(workloads, 'region')).sort();
  populateSelect(regionSelect, regionOptions, (value) => value);
  filterState.region = regionSelect.value;

  const serverlessOptions = Array.from(computeOptions(workloads, 'serverless')).sort();
  populateSelect(serverlessSelect, serverlessOptions, (value) => (value === 'true' ? 'Serverless' : 'Dedicated'));
  filterState.serverless = serverlessSelect.value;

  updateCurrentRecord();
}

function updateCurrentRecord() {
  if (!pricingData) {
    return;
  }
  const match = pricingData.workloads.find((record) => matchesFilters(record));
  currentRecord = match || null;
  if (!currentRecord) {
    selectedRateEl.textContent = '-- USD/DBU';
    effectiveDateEl.textContent = '--';
    sourceLinkEl.textContent = '--';
    recordNotesEl.textContent = '';
    breakdownEl.textContent = '該当するレコードがありません。条件を見直してください。';
    totalPriceEl.textContent = formatCurrency(0);
    dbuInput.disabled = true;
    calcBtn.disabled = true;
    return;
  }
  dbuInput.disabled = false;
  calcBtn.disabled = false;

  const currency = metadata?.currency || 'USD';
  selectedRateEl.textContent = `${currentRecord.dbu_rate.toFixed(2)} ${currency}/DBU`;
  effectiveDateEl.textContent = currentRecord.effective_from;
  sourceLinkEl.innerHTML = '';
  const link = document.createElement('a');
  link.href = currentRecord.source;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.className = 'inline-link';
  link.textContent = '表示';
  link.title = currentRecord.source;
  sourceLinkEl.appendChild(link);

  recordNotesEl.textContent = currentRecord.notes || '';
  calculate();
}

function calculate() {
  if (!currentRecord) {
    totalPriceEl.textContent = formatCurrency(0);
    breakdownEl.textContent = '該当するレコードがありません。';
    return;
  }
  const dbuUsageRaw = Number.parseFloat(dbuInput.value);
  const scenario = {
    rateQuery: {
      cloud: currentRecord.cloud,
      region: currentRecord.region,
      edition: currentRecord.edition,
      service: currentRecord.service,
      serverless: currentRecord.serverless
    },
    dbu: {
      dbu_per_month: Number.isFinite(dbuUsageRaw) ? dbuUsageRaw : undefined
    }
  };

  const result = estimate(scenario, pricingData);
  const currency = result.meta.currency || metadata?.currency || 'USD';
  const usageDisplay = result.dbu.usage_month.toLocaleString(undefined, {
    maximumFractionDigits: 2
  });
  const rateDisplay = result.dbu.rate.toFixed(2);

  totalPriceEl.textContent = formatCurrency(result.total, currency);

  const breakdownParts = [
    `DBU 単価 ${rateDisplay} ${currency}/DBU × DBU 使用量 ${usageDisplay} = ${formatCurrency(result.dbu.cost, currency)}`
  ];
  if (result.meta.assumptions.length > 0) {
    breakdownParts.push(`前提: ${result.meta.assumptions.join('; ')}`);
  }
  if (result.meta.warnings.length > 0) {
    breakdownParts.push(`警告: ${result.meta.warnings.join(', ')}`);
  }
  breakdownEl.textContent = breakdownParts.join('\n');
  saveUiState();
}

function attachListeners() {
  serviceSelect.dataset.field = 'service';
  editionSelect.dataset.field = 'edition';
  regionSelect.dataset.field = 'region';
  serverlessSelect.dataset.field = 'serverless';

  [serviceSelect, editionSelect, regionSelect, serverlessSelect].forEach((select) => {
    select.addEventListener('change', () => {
      filterState[select.dataset.field] = select.value;
      refreshSelectors();
    });
  });

  dbuInput.addEventListener('input', () => {
    calculate();
  });

  calcBtn.addEventListener('click', () => {
    calculate();
  });

  resetBtn.addEventListener('click', () => {
    filterState.service = '';
    filterState.edition = '';
    filterState.region = '';
    filterState.serverless = '';
    dbuInput.value = 1000;
    refreshSelectors();
    calculate();
  });
}

async function initialize() {
  try {
    const result = await loadPricingData();
    pricingData = result.data;
    metadata = result.metadata;

    setBadgeText(versionBadge, 'version', metadata.version);
    setBadgeText(currencyBadge, 'currency', metadata.currency);

    restoreUiState();
    attachListeners();
    refreshSelectors();

    clearBanners();
    if (result.issues && result.issues.length > 0) {
      const summary = summarizeIssues(result.issues);
      if (metadata.fromCache) {
        const storedAt = metadata.storedAt ? `保存時刻: ${metadata.storedAt}` : '保存済みデータを使用しています';
        createBanner('info', `最新の pricing.json の検証に失敗したため、${storedAt}。\n${summary}`);
      } else {
        createBanner('error', summary);
      }
    } else if (metadata.usedLegacyConversion) {
      createBanner('info', '旧フォーマットの pricing.json を検出したため、正規化データに変換して使用しています。');
    }
  } catch (error) {
    console.error(error);
    showError(`料金データの読み込みに失敗しました: ${error.message}`);
    disableInputs(true);
  }
}

initialize();
