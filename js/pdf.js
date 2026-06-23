// One-click PDF export, locked to US Letter regardless of the user's print
// settings. Each report-paper is rendered at high scale (crisp text + logos)
// and placed on its own Letter page.

const LETTER_W = 612; // pt (8.5in × 72)
const LETTER_H = 792; // pt (11in × 72)
const MARGIN = 18;

export async function exportReportPDF() {
  if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
    throw new Error('Las librerías de PDF no se cargaron. Recarga la página.');
  }
  const { jsPDF } = window.jspdf;
  const papers = [...document.querySelectorAll('#reports-container .report-paper')];
  if (!papers.length) throw new Error('No hay reporte para exportar.');

  // Capture the read-only view (badges, not the edit-mode dropdowns).
  const wasEdit = papers.filter(p => p.classList.contains('edit-mode'));
  wasEdit.forEach(p => p.classList.remove('edit-mode'));

  try {
    const pdf = new jsPDF({ unit: 'pt', format: 'letter', compress: true });
    const maxW = LETTER_W - 2 * MARGIN;
    const maxH = LETTER_H - 2 * MARGIN;

    for (let i = 0; i < papers.length; i++) {
      const canvas = await html2canvas(papers[i], {
        scale: 2.5,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });
      let w = maxW;
      let h = canvas.height * (w / canvas.width);
      if (h > maxH) { h = maxH; w = canvas.width * (h / canvas.height); }
      const x = (LETTER_W - w) / 2;
      if (i > 0) pdf.addPage('letter');
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', x, MARGIN, w, h);
    }

    const today = new Date().toISOString().slice(0, 10);
    pdf.save(`reporte_flowtech_${today}.pdf`);
  } finally {
    wasEdit.forEach(p => p.classList.add('edit-mode'));
  }
}
