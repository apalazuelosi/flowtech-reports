// Builds the Spanish analyst recommendation from the two independent levels
// (ISO/particles and water). Each message states the condition and the
// recommended action with its urgency and rationale. Levels come from
// classify.js so the text always agrees with the stop-signs shown.

export function buildRecommendation(isoLevel, waterLevel, waterPpm) {
  const ppm = waterPpm != null ? waterPpm.toLocaleString('es-MX') : '';

  // Particles only (water normal)
  if (waterLevel === 'normal') {
    if (isoLevel === 'critical') return 'La contaminación por partículas alcanza un nivel crítico que compromete la confiabilidad del sistema. Se requiere filtración de alta eficiencia o cambio de fluido a la brevedad para prevenir el desgaste acelerado de los componentes.';
    if (isoLevel === 'warning')  return 'La contaminación por partículas se encuentra en nivel de precaución. Se recomienda programar la filtración del fluido y verificar el estado de los filtros antes del siguiente ciclo de muestreo.';
    return 'El fluido se encuentra dentro de los parámetros de limpieza y contenido de agua establecidos. No se requiere acción correctiva; continuar con el monitoreo de rutina en el próximo ciclo de muestreo.';
  }

  // Water only (particles normal)
  if (isoLevel === 'normal') {
    if (waterLevel === 'critical') return `El contenido de agua alcanza un nivel crítico (${ppm} ppm), con riesgo de corrosión y pérdida de las propiedades lubricantes del fluido. Se requiere deshidratación a la brevedad para proteger el sistema.`;
    return `El contenido de agua se encuentra en nivel de precaución (${ppm} ppm). Se recomienda programar una actividad de deshidratación y monitorear su evolución en el próximo ciclo de muestreo.`;
  }

  // Combined scenarios
  if (isoLevel === 'critical' && waterLevel === 'critical')
    return `Tanto la contaminación por partículas como el contenido de agua (${ppm} ppm) se encuentran en nivel crítico. Se requiere filtración de alta eficiencia o cambio de fluido, junto con la deshidratación del fluido a la brevedad, para evitar daño a los componentes del sistema.`;
  if (isoLevel === 'critical' && waterLevel === 'warning')
    return `La contaminación por partículas alcanza un nivel crítico y requiere filtración de alta eficiencia o cambio de fluido a la brevedad. Adicionalmente, el contenido de agua se encuentra en nivel de precaución (${ppm} ppm); se recomienda programar una actividad de deshidratación.`;
  if (isoLevel === 'warning' && waterLevel === 'critical')
    return `El contenido de agua alcanza un nivel crítico (${ppm} ppm) y requiere deshidratación a la brevedad. La contaminación por partículas se encuentra en nivel de precaución; se recomienda programar filtración preventiva.`;
  // warning + warning
  return `La contaminación por partículas y el contenido de agua (${ppm} ppm) se encuentran en nivel de precaución. Se recomienda programar la filtración y la deshidratación del fluido dentro del próximo ciclo de mantenimiento.`;
}
