// CSV export for external portals (e.g. HYDAC). The column set and escaping are
// kept identical to the original production export so downstream uploads keep
// working. The single `status` column is derived deterministically from the
// active profile (worst of ISO/water) to match what the report shows.

import { classifyISO, classifyWater, overallStatus } from './classify.js';

const COLUMNS = [
  'lab_no', 'sampled_date', 'received_date', 'completed_date',
  'unit_id', 'component', 'empresa', 'reference_no',
  'fluid_manufacturer', 'fluid_product', 'fluid_grade',
  'iso_code', 'water_kf_ppm',
  'particles_4um', 'particles_6um', 'particles_14um',
  'particles_21um', 'particles_38um', 'particles_70um',
  'status', 'generated_by', 'generated_date',
];

const STATUS_LABEL = { error: 'DATO ERRÓNEO', critical: 'CRÍTICO', warning: 'PRECAUCIÓN', normal: 'ACEPTABLE' };

function escapeCsv(v) {
  const val = v == null ? '' : String(v);
  return /[",\n]/.test(val) ? '"' + val.replace(/"/g, '""') + '"' : val;
}

// state = { samples, empresa, generadoPor, profile }
export function downloadCSV(state) {
  const { samples, empresa, generadoPor, profile } = state;
  if (!samples || !samples.length) return;
  const today = new Date().toISOString().slice(0, 10);

  const rows = samples.map(d => {
    const isoLv = d._isoLevel || classifyISO(d.isoCode, profile);
    const waterLv = d._waterLevel || classifyWater(d.waterKFppm, profile);
    const level = overallStatus(isoLv, waterLv);
    return [
      d.labNo, d.sampledDate, d.receivedDate, d.completedDate,
      d.unitId, d.componentDescription,
      empresa || d.worksite,
      d.referenceNo, d.fluidManufacturer, d.fluidProduct,
      d.fluidGrade ? 'ISO ' + d.fluidGrade.replace(/iso\s*/i, '') : '',
      d.isoCode, d.waterKFppm,
      d.particles4um, d.particles6um, d.particles14um,
      d.particles21um, d.particles38um, d.particles70um,
      STATUS_LABEL[level],
      generadoPor || d.evaluatedBy,
      today,
    ].map(escapeCsv).join(',');
  });

  const csv = [COLUMNS.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `flowtech_${today}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
