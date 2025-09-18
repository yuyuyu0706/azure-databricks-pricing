let pricingData = null;

// DOM 要素
const workloadEl = document.getElementById('workload');
const instanceEl = document.getElementById('instanceType');
const clusterEl = document.getElementById('clusterSize');
const hoursEl = document.getElementById('hours');
const regionEl = document.getElementById('region');
const totalPriceEl = document.getElementById('totalPrice');
const breakdownEl = document.getElementById('breakdownText');
const calcBtn = document.getElementById('calcBtn');
const resetBtn = document.getElementById('resetBtn');

function formatYen(val){
  return '¥' + Number(val).toLocaleString('ja-JP', {maximumFractionDigits:0});
}

function loadPricing(){
  return fetch('pricing.json')
    .then(resp => {
      if (!resp.ok) throw new Error('pricing.json を取得できません: ' + resp.status);
      return resp.json();
    })
    .then(json => {
      pricingData = json;
      populateControls();
      calculate(); // 初期計算
    })
    .catch(err => {
      console.error(err);
      breakdownEl.textContent = '料金データの読み込みに失敗しました。コンソールを確認してください。';
    });
}

function populateControls(){
  // ワークロード
  workloadEl.innerHTML = '';
  for (const key of Object.keys(pricingData.workloads)) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = pricingData.workloads[key].label || key;
    workloadEl.appendChild(opt);
  }

  // インスタンスタイプ
  instanceEl.innerHTML = '';
  for (const key of Object.keys(pricingData.instances)) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = pricingData.instances[key].label || key;
    instanceEl.appendChild(opt);
  }

  // クラスターサイズ
  clusterEl.innerHTML = '';
  for (const key of Object.keys(pricingData.clusters)) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = `${pricingData.clusters[key].label} — ${pricingData.clusters[key].nodes} ノード`;
    clusterEl.appendChild(opt);
  }

  // リージョン
  regionEl.innerHTML = '';
  for (const key of Object.keys(pricingData.regions)) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = pricingData.regions[key].label;
    regionEl.appendChild(opt);
  }

  // 初期値選択（任意）
  workloadEl.value = Object.keys(pricingData.workloads)[0];
  instanceEl.value = Object.keys(pricingData.instances)[0];
  clusterEl.value = Object.keys(pricingData.clusters)[0];
  regionEl.value = Object.keys(pricingData.regions)[0];
}

function calculate(){
  if (!pricingData) {
    breakdownEl.textContent = '料金データがロードされていません';
    return;
  }

  const workloadKey = workloadEl.value;
  const instanceKey = instanceEl.value;
  const clusterKey = clusterEl.value;
  const regionKey = regionEl.value;
  const hours = Math.max(0, parseFloat(hoursEl.value) || 0);

  const cluster = pricingData.clusters[clusterKey];
  const instance = pricingData.instances[instanceKey];
  const workload = pricingData.workloads[workloadKey];
  const region = pricingData.regions[regionKey];

  const nodes = cluster.nodes;
  const dbuPerNode = instance.dbu_per_node || 1;

  // DBU 単価（インスタンスタイプ別）。もし workload に該当する dbu_rates に instanceKey がなければエラーハンドリング
  const dbuRateUSD = (workload.dbu_rates && workload.dbu_rates[instanceKey]) || 0;
  const vmRateUSD = instance.vm_rate || 0;

  // DBU の総数（単純モデル）
  const dbuCount = nodes * dbuPerNode;

  // 合計 USD
  const totalUSD = (dbuRateUSD * dbuCount + vmRateUSD * nodes) * hours;

  // リージョン乗数を適用（例: 料金に地域係数を掛ける）
  const regionMultiplier = region.multiplier || 1.0;
  const totalUSDAdjusted = totalUSD * regionMultiplier;

  const exchange = (pricingData.exchange && pricingData.exchange.USDJPY) || 150;
  const totalJPY = totalUSDAdjusted * exchange;

  // 内訳
  const dbuCostUSD = dbuRateUSD * dbuCount * hours * regionMultiplier;
  const vmCostUSD = vmRateUSD * nodes * hours * regionMultiplier;

  totalPriceEl.textContent = formatYen(totalJPY);
  breakdownEl.textContent =
    `DBU: $${dbuCostUSD.toFixed(2)} / VM: $${vmCostUSD.toFixed(2)}  合計: $${(dbuCostUSD + vmCostUSD).toFixed(2)} (USD)  （為替 ${exchange} JPY = 1 USD）`;
}

calcBtn.addEventListener('click', calculate);
resetBtn.addEventListener('click', () => {
  if (!pricingData) return;
  workloadEl.value = Object.keys(pricingData.workloads)[0];
  instanceEl.value = Object.keys(pricingData.instances)[0];
  clusterEl.value = Object.keys(pricingData.clusters)[0];
  regionEl.value = Object.keys(pricingData.regions)[0];
  hoursEl.value = '1';
  calculate();
});

// 初期ロード
loadPricing();