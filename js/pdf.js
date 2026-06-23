// One-click PDF export, locked to US Letter regardless of print settings.
// Each report-paper is rendered at high scale (crisp text + logos) onto its own
// Letter page.
//
// html2canvas clips <textarea>/<input> content, so before capturing we swap
// every editable field for a plain <div> holding its current value (which
// renders fully and sharply), then restore the originals afterwards.

const LETTER_W = 612; // pt
const LETTER_H = 792; // pt
const MARGIN = 8;
const SCALE = 2.6;

// Replace editable fields in `paper` with text divs; returns a restore fn.
function fieldsToText(paper) {
  const swaps = [];
  paper.querySelectorAll('.editable-field, .editable-rec').forEach(el => {
    const div = document.createElement('div');
    div.className = el.className;
    div.textContent = el.value;
    div.style.pointerEvents = 'none';
    if (el.classList.contains('editable-rec')) {
      div.style.height = 'auto';
      div.style.minHeight = '0';
      div.style.whiteSpace = 'pre-wrap';
    }
    el.replaceWith(div);
    swaps.push([div, el]);
  });
  return () => swaps.forEach(([div, el]) => div.replaceWith(el));
}

export async function exportReportPDF() {
  if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
    throw new Error('Las librerías de PDF no se cargaron. Recarga la página.');
  }
  const { jsPDF } = window.jspdf;
  const papers = [...document.querySelectorAll('#reports-container .report-paper')];
  if (!papers.length) throw new Error('No hay reporte para exportar.');

  // Capture the read-only view (badges, not the edit dropdowns).
  const wasEdit = papers.filter(p => p.classList.contains('edit-mode'));
  wasEdit.forEach(p => p.classList.remove('edit-mode'));

  const pdf = new jsPDF({ unit: 'pt', format: 'letter', compress: true });
  const maxW = LETTER_W - 2 * MARGIN;
  const maxH = LETTER_H - 2 * MARGIN;

  try {
    for (let i = 0; i < papers.length; i++) {
      const restore = fieldsToText(papers[i]);
      let canvas;
      try {
        canvas = await html2canvas(papers[i], {
          scale: SCALE,
          backgroundColor: '#ffffff',
          useCORS: true,
          logging: false,
          windowWidth: papers[i].scrollWidth,
        });
      } finally {
        restore();
      }

      let w = maxW;
      let h = canvas.height * (w / canvas.width);
      if (h > maxH) { h = maxH; w = canvas.width * (h / canvas.height); }
      const x = (LETTER_W - w) / 2;
      const y = (LETTER_H - h) / 2; // center vertically too
      if (i > 0) pdf.addPage('letter');
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, w, h);
    }

    const today = new Date().toISOString().slice(0, 10);
    pdf.save(`reporte_flowtech_${today}.pdf`);
  } finally {
    wasEdit.forEach(p => p.classList.add('edit-mode'));
  }
}
