// CSV export for external portals (e.g. HYDAC). The column set and escaping are
// kept identical to the original production export so downstream uploads keep
// working. The single `status` column is derived deterministically from the
// active profile (worst of ISO/water) to match what the report shows.

import { classifyISO, classifyWater, overallStatus, isoLimits, fmtISO } from './classify.js';

const COLUMNS = [
  'lab_no', 'sampled_date', 'received_date', 'completed_date',
  'unit_id', 'component', 'empresa', 'reference_no',
  'fluid_manufacturer', 'fluid_product', 'fluid_grade',
  'iso_code', 'water_kf_ppm',
  'particles_4um', 'particles_6um', 'particles_14um',
  'particles_21um', 'particles_38um', 'particles_70um',
  'status', 'generated_by', 'generated_date',
  // Per-parameter status + the profile limits applied to that row, so the
  // downstream (Cowork) lab-report generator reads them straight from the CSV.
  'iso_status', 'water_status',
  'iso_limit_prec', 'iso_limit_crit',
  'water_limit_prec', 'water_limit_crit',
];

const STATUS_LABEL = { error: 'DATO ERRONEO', critical: 'CRITICO', warning: 'PRECAUCION', normal: 'ACEPTABLE' };

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

    // Per-parameter status + applied profile limits. Left blank for erroneous
    // samples (per spec), since the semáforo isn't meaningful there.
    const erroneous = level === 'error';
    const isoStatus = erroneous ? '' : STATUS_LABEL[isoLv];
    const waterStatus = erroneous ? '' : STATUS_LABEL[waterLv];
    const isoPrec = erroneous ? '' : fmtISO(isoLimits(profile.iso.warn));
    const isoCrit = erroneous ? '' : fmtISO(isoLimits(profile.iso.crit));
    const waterPrec = erroneous ? '' : profile.water.warn;
    const waterCrit = erroneous ? '' : profile.water.crit;

    return [
      d.labNo, d.sampledDate, d.receivedDate, d.completedDate,
      d.unitId, d.componentDescription,
      d.worksite || empresa,
      d.referenceNo, d.fluidManufacturer, d.fluidProduct,
      d.fluidGrade ? 'ISO ' + d.fluidGrade.replace(/iso\s*/i, '') : '',
      d.isoCode, d.waterKFppm,
      d.particles4um, d.particles6um, d.particles14um,
      d.particles21um, d.particles38um, d.particles70um,
      STATUS_LABEL[level],
      d.evaluatedBy || generadoPor,
      today,
      isoStatus, waterStatus,
      isoPrec, isoCrit,
      waterPrec, waterCrit,
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
