export const PRESETS = Object.freeze([
  {
    key: 'jobs_etl',
    labelKey: 'preset.jobs_etl',
    descriptionKey: 'preset.jobs_etl.desc',
    inputs: {
      dbu_per_month: null,
      cluster_dbu_per_hour: null,
      hours_per_month: null,
      avg_nodes: null,
      min_nodes: 2,
      max_nodes: 6,
      runs_per_day: 2,
      avg_run_hours: 2,
      idle_hours_per_run: 0.5,
      idle_minutes: 15,
      days_per_month: 30,
      efficiency_factor: 1,
      dbu_per_node_hour: 1.2,
      retry_rate: null,
      concurrency: 1
    }
  },
  {
    key: 'sql_warehouse',
    labelKey: 'preset.sql_warehouse',
    descriptionKey: 'preset.sql_warehouse.desc',
    inputs: {
      dbu_per_month: null,
      cluster_dbu_per_hour: null,
      hours_per_month: null,
      avg_nodes: null,
      min_nodes: 2,
      max_nodes: 4,
      runs_per_day: 24,
      avg_run_hours: 0.5,
      idle_hours_per_run: 0.25,
      idle_minutes: 5,
      days_per_month: 30,
      efficiency_factor: 1,
      dbu_per_node_hour: 0.9,
      retry_rate: null,
      concurrency: 4
    }
  },
  {
    key: 'serverless_sql',
    labelKey: 'preset.serverless_sql',
    descriptionKey: 'preset.serverless_sql.desc',
    inputs: {
      dbu_per_month: null,
      cluster_dbu_per_hour: null,
      hours_per_month: null,
      avg_nodes: null,
      min_nodes: 1,
      max_nodes: 1,
      runs_per_day: 24,
      avg_run_hours: 0.25,
      idle_hours_per_run: 0,
      idle_minutes: 0,
      days_per_month: 30,
      efficiency_factor: 1,
      dbu_per_node_hour: 1,
      retry_rate: null,
      concurrency: 8
    }
  },
  {
    key: 'model_serving',
    labelKey: 'preset.model_serving',
    descriptionKey: 'preset.model_serving.desc',
    inputs: {
      dbu_per_month: null,
      cluster_dbu_per_hour: null,
      hours_per_month: null,
      avg_nodes: null,
      min_nodes: 1,
      max_nodes: 3,
      runs_per_day: 24,
      avg_run_hours: 0.0417,
      idle_hours_per_run: 0,
      idle_minutes: 0,
      days_per_month: 30,
      efficiency_factor: 1,
      dbu_per_node_hour: 0.6,
      retry_rate: null,
      concurrency: 2
    }
  },
  {
    key: 'dlt',
    labelKey: 'preset.dlt',
    descriptionKey: 'preset.dlt.desc',
    inputs: {
      dbu_per_month: null,
      cluster_dbu_per_hour: null,
      hours_per_month: null,
      avg_nodes: null,
      min_nodes: 2,
      max_nodes: 8,
      runs_per_day: 1,
      avg_run_hours: 4,
      idle_hours_per_run: 0.5,
      idle_minutes: 10,
      days_per_month: 30,
      efficiency_factor: 1,
      dbu_per_node_hour: 1.3,
      retry_rate: null,
      concurrency: 1
    }
  }
]);

export function getPreset(key) {
  return PRESETS.find((preset) => preset.key === key) || null;
}

export default { PRESETS, getPreset };
