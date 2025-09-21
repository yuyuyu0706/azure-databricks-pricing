const DICTIONARIES = {
  ja: {
    'app.title': 'Azure Databricks Pricing Simulator Orange',
    'header.badge.version': '価格データ',
    'header.badge.currency': '通貨',
    'header.badge.region': 'リージョン',
    'header.badge.edition': 'エディション',
    'header.help': 'ヘルプ',
    'rates.section.title': 'レート選択',
    'rates.service': 'サービス',
    'rates.vm_size': 'VMサイズ',
    'rates.edition': 'エディション',
    'rates.region': 'リージョン',
    'rates.serverless': 'サーバーレス',
    'input.section.title': 'DBU 使用量の指定',
    'input.mode.direct': '直接入力（DBU/月）',
    'input.mode.derived': '導出入力（ノード・時間）',
    'input.dbu_per_month': 'DBU/月',
    'input.cluster_dbu_per_hour': 'クラスタ DBU/時',
    'input.hours_per_month': '稼働時間/月（時間）',
    'input.preset.title': 'プリセット',
    'input.preset.label': 'ワークロード テンプレート',
    'input.cluster.title': 'DBU レート',
    'input.autoscale.title': 'オートスケール',
    'input.workload.title': 'ワークロード パターン',
    'input.advanced.title': '高度な調整',
    'input.avg_nodes': '平均ノード数',
    'input.dbu_per_node_hour': 'ノードあたり DBU/時',
    'input.min_nodes': '最小ノード数',
    'input.max_nodes': '最大ノード数',
    'input.runs_per_day': '1日の実行回数',
    'input.avg_run_hours': '1回あたりの実行時間（時間）',
    'input.idle_hours': 'アイドル時間/実行（時間）',
    'input.idle_minutes': 'アイドル自動終了（分）',
    'input.days_per_month': '計算対象日数/月',
    'input.efficiency': '効率係数（<1で効率化）',
    'input.retry_rate': '再実行率（予約）',
    'input.concurrency': '同時実行数（予約）',
    'sensitivity.title': '感度分析（±%）',
    'sensitivity.nodes': 'ノード数',
    'sensitivity.hours': '稼働時間',
    'sensitivity.efficiency': '効率',
    'currency.section.title': '通貨と為替',
    'currency.output': '表示通貨',
    'currency.fx_rate': '為替レート',
    'scenario.section.title': 'シナリオ',
    'scenario.save': '保存',
    'scenario.load': '読込',
    'scenario.delete': '削除',
    'scenario.name': 'シナリオ名',
    'scenario.overwrite': '同名のシナリオが存在します。上書きしますか？',
    'scenario.save_variant': 'Variant を保存',
    'scenario.load.title': 'シナリオを選択',
    'scenario.load.description': 'シナリオを Base または Variant に適用します。',
    'scenario.load.base': 'Base に適用',
    'scenario.load.variant': 'Variant に適用',
    'scenario.load.delete': '削除',
    'scenario.load.empty': '保存済みシナリオがありません。',
    'scenario.saved': 'シナリオを保存しました。',
    'scenario.deleted': 'シナリオを削除しました。',
    'scenario.loaded': 'シナリオを読み込みました。',
    'scenario.current': '現在のシナリオ: {name}',
    'scenario.name.placeholder': '例: PoC 7月版',
    'scenario.delete.confirm': 'シナリオ「{name}」を削除しますか？',
    'scenario.not_found': '指定したシナリオが見つかりません。',
    'settings.section.title': 'その他',
    'settings.rounding': '丸め規則',
    'settings.scale': '表示桁数',
    'settings.dark_mode': 'ダークモード',
    'results.section.title': '結果',
    'results.base': 'Base',
    'results.variant': 'Variant',
    'results.total': '合計',
    'results.dbu': 'DBU',
    'results.infra': 'インフラ',
    'results.delta': '差額',
    'results.min': '最小',
    'results.expected': '期待値',
    'results.max': '最大',
    'results.warnings': '警告',
    'results.assumptions': '前提・仮定',
    'results.badge.warning': '警告 ×{count}',
    'results.badge.assumption': '前提 ×{count}',
    'results.breakdown.title': '内訳',
    'variant.copy_from_base': 'Variant にコピー',
    'variant.clear': 'Variant をクリア',
    'variant.empty': 'Variant が未設定です。',
    'variant.updated': 'Variant を更新しました。',
    'variant.current': 'Variant: {name}',
    'variant.delta.currency_mismatch': 'Base と Variant の通貨が一致しないため差額を表示できません。',
    'source.title': '価格の出典',
    'source.label': '出典',
    'source.link': '出典を開く',
    'source.effective_from': '適用開始日',
    'banner.error.load': '価格データの読み込みに失敗しました。',
    'banner.warn.lkg': '前回の正常版データを使用しています。',
    'banner.error.input': '入力値を確認してください。',
    'banner.success.save': 'シナリオを保存しました。',
    'banner.success.delete': 'シナリオを削除しました。',
    'banner.success.variant_copied': '現在の条件を Variant にコピーしました。',
    'banner.info.variant_cleared': 'Variant をクリアしました。',
    'banner.success.variant_saved': 'Variant をシナリオとして保存しました。',
    'banner.error.variant_missing': 'Variant が未設定のため保存できません。',
    'banner.error.variant_copy': 'Base の条件が不完全なため Variant にコピーできません。',
    'banner.error.scenario_required': 'シナリオ名を入力してください。',
    'banner.error.scenario_not_found': '指定したシナリオが見つかりません。',
    'banner.error.variant_invalid': 'Variant の計算に必要な情報が不足しています。',
    'banner.info.base_loaded': 'Base にシナリオを適用しました。',
    'banner.info.variant_loaded': 'Variant にシナリオを適用しました。',
    'banner.info.cache': 'キャッシュ済みデータを使用しています。',
    'modal.close': '閉じる',
    'help.intro': 'シミュレーターの操作手順とヒントです。',
    'help.step.setup': 'レート選択とDBU/ノード条件を入力すると Base カードが即時計算されます。',
    'help.step.variant': '比較したい条件は「Variant にコピー」または読込モーダルから Variant に適用してください。',
    'help.step.scenario': '現在の Base は「保存」、Variant は「Variant を保存」でシナリオ登録し、必要に応じて読込/削除します。',
    'help.step.sensitivity': '感度分析をオンにすると ±% を指定して最小・期待値・最大のレンジを確認できます。',
    'help.step.shortcuts': 'キーボードショートカット: S=保存、V=Variant保存、L=読込、D=削除。',
    'footer.disclaimer': 'DBU はプラットフォーム課金です。推定結果は参考値であり、インフラ費用は別途加算されます。',
    'warning.NO_RATE_MATCH': '一致するレートが見つかりません。',
    'warning.MISSING_INPUT': '必要な入力値が不足しています。',
    'warning.NEGATIVE_OR_NAN': '負数または無効な値が検出されました。',
    'warning.FALLBACK_AVG_NODES_USED': '平均ノード数が推定値で計算されています。',
    'warning.DBU_PER_NODE_HOUR_ASSUMED': 'ノードあたりDBUが未入力のため既定値で計算しました。',
    'error.number_required': '数値を入力してください。',
    'error.non_negative': '0以上の値を入力してください。',
    'error.positive': '0より大きい値を入力してください。',
    'error.selection_required': '選択してください。',
    'error.range': '{min}〜{max}の範囲で入力してください。',
    'preset.none': 'プリセットなし',
    'preset.jobs_etl': 'Jobs / ETL',
    'preset.jobs_etl.desc': 'バッチETLを想定（2回/日、Photon/効率=1.0、短時間アイドル）',
    'preset.sql_warehouse': 'SQL Warehouse',
    'preset.sql_warehouse.desc': 'BIダッシュボード。短時間クエリと最小2〜4ノード構成',
    'preset.serverless_sql': 'Serverless SQL',
    'preset.serverless_sql.desc': '完全サーバーレス。常時オンでミリ秒起動、アイドルは自動課金のみ',
    'preset.model_serving': 'Model Serving',
    'preset.model_serving.desc': '24時間推論を想定。1〜3ノードの自動スケールと低DBU',
    'preset.dlt': 'Delta Live Tables',
    'preset.dlt.desc': '1日1回のパイプライン。オートスケール幅広めで長時間実行',
    'help.preset': 'ワークロードの推奨値を一括で読み込みます。選択後は各フィールドを個別に調整できます。',
    'help.cluster_dbu_per_hour': '価格表からクラスタDBU/時を直接入力、またはノードあたりDBU×平均ノードで導出します。',
    'help.autoscale': '最小・最大ノードを指定すると平均ノードが未入力でも中間値で推定します。',
    'help.workload': '実行回数×日数×時間で稼働時間を算出します。アイドル自動終了で待機時間を上限設定できます。',
    'help.advanced': '効率係数はPhotonやキャッシュ最適化によるDBU削減を表します。再実行率・同時実行数は将来利用予定です。'
  },
  en: {
    'app.title': 'Azure Databricks Pricing Simulator Orange',
    'header.badge.version': 'Pricing Data',
    'header.badge.currency': 'Currency',
    'header.badge.region': 'Region',
    'header.badge.edition': 'Edition',
    'header.help': 'Help',
    'rates.section.title': 'Rate Selection',
    'rates.service': 'Service',
    'rates.vm_size': 'VM size',
    'rates.edition': 'Edition',
    'rates.region': 'Region',
    'rates.serverless': 'Serverless',
    'input.section.title': 'Specify DBU Usage',
    'input.mode.direct': 'Direct Input (DBU/month)',
    'input.mode.derived': 'Derived Input (Nodes & Hours)',
    'input.dbu_per_month': 'DBU / month',
    'input.cluster_dbu_per_hour': 'Cluster DBU / hour',
    'input.hours_per_month': 'Hours / month',
    'input.preset.title': 'Presets',
    'input.preset.label': 'Workload template',
    'input.cluster.title': 'DBU rate inputs',
    'input.autoscale.title': 'Autoscale',
    'input.workload.title': 'Workload pattern',
    'input.advanced.title': 'Advanced tuning',
    'input.avg_nodes': 'Average nodes',
    'input.dbu_per_node_hour': 'DBU per node hour',
    'input.min_nodes': 'Min nodes',
    'input.max_nodes': 'Max nodes',
    'input.runs_per_day': 'Runs per day',
    'input.avg_run_hours': 'Run duration (hours)',
    'input.idle_hours': 'Idle hours / run',
    'input.idle_minutes': 'Idle termination (minutes)',
    'input.days_per_month': 'Billing days / month',
    'input.efficiency': 'Efficiency factor (<1 improves)',
    'input.retry_rate': 'Retry rate (reserved)',
    'input.concurrency': 'Concurrency (reserved)',
    'sensitivity.title': 'Sensitivity (±%)',
    'sensitivity.nodes': 'Nodes',
    'sensitivity.hours': 'Hours',
    'sensitivity.efficiency': 'Efficiency',
    'currency.section.title': 'Currency & FX',
    'currency.output': 'Output currency',
    'currency.fx_rate': 'FX rate',
    'scenario.section.title': 'Scenarios',
    'scenario.save': 'Save',
    'scenario.load': 'Load',
    'scenario.delete': 'Delete',
    'scenario.name': 'Scenario name',
    'scenario.overwrite': 'Scenario with the same name exists. Overwrite?',
    'scenario.save_variant': 'Save Variant',
    'scenario.load.title': 'Select a scenario',
    'scenario.load.description': 'Apply a saved scenario to the Base or Variant card.',
    'scenario.load.base': 'Apply to Base',
    'scenario.load.variant': 'Apply to Variant',
    'scenario.load.delete': 'Delete',
    'scenario.load.empty': 'No saved scenarios yet.',
    'scenario.saved': 'Scenario saved.',
    'scenario.deleted': 'Scenario deleted.',
    'scenario.loaded': 'Scenario loaded.',
    'scenario.current': 'Current scenario: {name}',
    'scenario.name.placeholder': 'e.g. PoC July',
    'scenario.delete.confirm': 'Delete scenario "{name}"?',
    'scenario.not_found': 'Scenario not found.',
    'settings.section.title': 'Other settings',
    'settings.rounding': 'Rounding mode',
    'settings.scale': 'Decimal places',
    'settings.dark_mode': 'Dark mode',
    'results.section.title': 'Results',
    'results.base': 'Base',
    'results.variant': 'Variant',
    'results.total': 'Total',
    'results.dbu': 'DBU',
    'results.infra': 'Infra',
    'results.delta': 'Delta',
    'results.min': 'Min',
    'results.expected': 'Expected',
    'results.max': 'Max',
    'results.warnings': 'Warnings',
    'results.assumptions': 'Assumptions',
    'results.badge.warning': 'Warnings ×{count}',
    'results.badge.assumption': 'Assumptions ×{count}',
    'results.breakdown.title': 'Breakdown',
    'variant.copy_from_base': 'Copy to Variant',
    'variant.clear': 'Clear Variant',
    'variant.empty': 'Variant is not set.',
    'variant.updated': 'Variant updated.',
    'variant.current': 'Variant: {name}',
    'variant.delta.currency_mismatch': 'Cannot compute delta because Base and Variant use different currencies.',
    'source.title': 'Pricing Source',
    'source.label': 'Source',
    'source.link': 'Open source',
    'source.effective_from': 'Effective from',
    'banner.error.load': 'Failed to load pricing data.',
    'banner.warn.lkg': 'Using last known good data.',
    'banner.error.input': 'Please check your inputs.',
    'banner.success.save': 'Scenario saved.',
    'banner.success.delete': 'Scenario deleted.',
    'banner.success.variant_copied': 'Current state copied to Variant.',
    'banner.info.variant_cleared': 'Variant cleared.',
    'banner.success.variant_saved': 'Variant saved as a scenario.',
    'banner.error.variant_missing': 'Variant is not set, so it cannot be saved.',
    'banner.error.variant_copy': 'Cannot copy to Variant because the Base inputs are incomplete.',
    'banner.error.scenario_required': 'Please enter a scenario name.',
    'banner.error.scenario_not_found': 'Scenario not found.',
    'banner.error.variant_invalid': 'Variant cannot be calculated with the provided values.',
    'banner.info.base_loaded': 'Scenario applied to Base.',
    'banner.info.variant_loaded': 'Scenario applied to Variant.',
    'banner.info.cache': 'Using cached pricing data.',
    'modal.close': 'Close',
    'help.intro': 'Quick tips for operating the simulator.',
    'help.step.setup': 'Choose rates and usage inputs to calculate the Base card instantly.',
    'help.step.variant': 'Use "Copy to Variant" or apply a saved scenario to populate the Variant card for side-by-side comparison.',
    'help.step.scenario': 'Register the current Base with Save, or the Variant with Save Variant, then load or delete from the scenario modal.',
    'help.step.sensitivity': 'Enable sensitivity to explore ±% swings and review the min / expected / max totals.',
    'help.step.shortcuts': 'Keyboard shortcuts: S=Save, V=Save Variant, L=Load, D=Delete.',
    'footer.disclaimer': 'DBU charges cover platform usage only. Infrastructure costs are estimated separately.',
    'warning.NO_RATE_MATCH': 'No matching rate found.',
    'warning.MISSING_INPUT': 'Required inputs are missing.',
    'warning.NEGATIVE_OR_NAN': 'Negative or invalid value detected.',
    'warning.FALLBACK_AVG_NODES_USED': 'Average nodes estimated from min/max.',
    'warning.DBU_PER_NODE_HOUR_ASSUMED': 'DBU per node hour not provided; used default assumption.',
    'error.number_required': 'Enter a numeric value.',
    'error.non_negative': 'Enter a value greater than or equal to 0.',
    'error.positive': 'Enter a value greater than 0.',
    'error.selection_required': 'Select a value.',
    'error.range': 'Enter a value between {min} and {max}.',
    'preset.none': 'No preset',
    'preset.jobs_etl': 'Jobs / ETL',
    'preset.jobs_etl.desc': 'Batch ETL runs twice per day with short idle windows.',
    'preset.sql_warehouse': 'SQL Warehouse',
    'preset.sql_warehouse.desc': 'BI dashboards with frequent short queries and 2–4 node autoscale.',
    'preset.serverless_sql': 'Serverless SQL',
    'preset.serverless_sql.desc': 'Fully serverless warehouse with 24×7 availability and on-demand scaling.',
    'preset.model_serving': 'Model Serving',
    'preset.model_serving.desc': 'Online inference workloads with small always-on footprint.',
    'preset.dlt': 'Delta Live Tables',
    'preset.dlt.desc': 'Daily pipelines with wide autoscale range and longer run durations.',
    'help.preset': 'Apply a recommended starting point for usage assumptions; tweak fields afterward as needed.',
    'help.cluster_dbu_per_hour': 'Input cluster DBU/hour directly or derive it from average nodes and DBU per node hour.',
    'help.autoscale': 'Provide min and max nodes for autoscaling; the simulator averages them when avg nodes is omitted.',
    'help.workload': 'Runs per day × days per month × run duration drives active hours. Idle termination caps idle time.',
    'help.advanced': 'Efficiency models Photon or caching gains. Retry rate and concurrency are placeholders for future logic.'
  }
};

let currentLanguage = 'ja';

function substitute(template, replacements = {}) {
  let output = template;
  Object.entries(replacements).forEach(([key, value]) => {
    output = output.replaceAll(`{${key}}`, value ?? '');
  });
  return output;
}

export function t(key, replacements = {}, lang = currentLanguage) {
  const table = DICTIONARIES[lang] || DICTIONARIES.ja;
  const template = table[key] ?? key;
  return substitute(template, replacements);
}

export function setLanguage(lang) {
  if (DICTIONARIES[lang]) {
    currentLanguage = lang;
  }
  return currentLanguage;
}

function applyAttributeTranslations(element, lang) {
  for (const attrName of element.getAttributeNames()) {
    if (!attrName.startsWith('data-i18n-') || attrName === 'data-i18n') {
      continue;
    }
    const targetAttr = attrName.replace('data-i18n-', '');
    const key = element.getAttribute(attrName);
    if (!key) continue;
    const value = t(key, {}, lang);
    if (targetAttr === 'text') {
      element.textContent = value;
    } else {
      element.setAttribute(targetAttr, value);
    }
  }
}

export function applyTranslations(root = document, lang = currentLanguage) {
  const effectiveLang = setLanguage(lang);
  const elements = root.querySelectorAll('[data-i18n]');
  elements.forEach((element) => {
    const key = element.getAttribute('data-i18n');
    if (!key) return;
    element.textContent = t(key, {}, effectiveLang);
    applyAttributeTranslations(element, effectiveLang);
  });
  const placeholderElements = root.querySelectorAll('[data-i18n-placeholder]');
  placeholderElements.forEach((element) => {
    const key = element.getAttribute('data-i18n-placeholder');
    if (!key) return;
    element.setAttribute('placeholder', t(key, {}, effectiveLang));
  });
}

export function getCurrentLanguage() {
  return currentLanguage;
}

export default {
  t,
  setLanguage,
  applyTranslations,
  getCurrentLanguage
};
