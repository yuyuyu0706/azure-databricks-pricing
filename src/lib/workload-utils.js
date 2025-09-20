export function createWorkloadKey(record) {
  return [record.cloud, record.region, record.edition, record.service, record.serverless].join('||');
}

export function detectDuplicateWorkloads(workloads = []) {
  const duplicates = [];
  const seen = new Map();
  workloads.forEach((record, index) => {
    const key = createWorkloadKey(record);
    if (seen.has(key)) {
      duplicates.push(`Duplicate workload combination detected for (${key}) at indexes ${seen.get(key)} and ${index}`);
    } else {
      seen.set(key, index);
    }
  });
  return duplicates;
}
