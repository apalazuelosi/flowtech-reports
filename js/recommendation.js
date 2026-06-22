// Builds the Spanish "Nota del Analista" recommendation from the two
// independent levels (ISO/particles and water). Levels come from classify.js
// so the text always agrees with the stop-signs shown in the report.

export function buildRecommendation(isoLevel, waterLevel, waterPpm) {
  const ppm = waterPpm != null ? waterPpm.toLocaleString('es-MX') : '';

  // Particles only (water normal)
  if (waterLevel === 'normal') {
    if (isoLevel === 'critical') return 'Nivel de contaminación por partículas crítico. Se requiere filtración de alta eficiencia o cambio de fluido a la brevedad para evitar daño al sistema.';
    if (isoLevel === 'warning')  return 'Se detecta contaminación por partículas en nivel de precaución. Se recomienda programar filtración y monitorear en el próximo ciclo de muestreo.';
    return 'El fluido presenta niveles de contaminación por partículas dentro de los parámetros aceptables. No se requiere acción correctiva.';
  }

  // Water only (particles normal)
  if (isoLevel === 'normal') {
    if (waterLevel === 'critical') return `Contenido de agua en nivel crítico (${ppm} ppm). Se requiere programar actividad de deshidratación a la brevedad para evitar daño al sistema.`;
    return `Contenido de agua en nivel de precaución (${ppm} ppm). Se recomienda programar actividad de deshidratación y monitorear en el próximo ciclo de muestreo.`;
  }

  // Combined scenarios
  if (isoLevel === 'critical' && waterLevel === 'critical')
    return `Nivel de contaminación por partículas crítico y contenido de agua crítico (${ppm} ppm). Se requiere filtración de alta eficiencia o cambio de fluido, así como programar actividad de deshidratación a la brevedad para evitar daño al sistema.`;
  if (isoLevel === 'critical' && waterLevel === 'warning')
    return `Nivel de contaminación por partículas crítico. Se requiere filtración de alta eficiencia o cambio de fluido a la brevedad. Adicionalmente, el contenido de agua se encuentra en nivel de precaución (${ppm} ppm) — se recomienda programar actividad de deshidratación.`;
  if (isoLevel === 'warning' && waterLevel === 'critical')
    return `Se detecta contaminación por partículas en nivel de precaución y contenido de agua crítico (${ppm} ppm). Se recomienda programar filtración preventiva y actividad de deshidratación a la brevedad para evitar daño al sistema.`;
  // warning + warning
  return `Se detecta contaminación por partículas y contenido de agua en nivel de precaución (${ppm} ppm). Se recomienda programar filtración y actividad de deshidratación en el próximo ciclo de mantenimiento.`;
}
