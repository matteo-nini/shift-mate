import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { formatHours, formatCurrency } from './shiftUtils';

interface ShiftData {
  date: string;
  start_time: string;
  end_time: string;
  hours: number;
  type: 'contract' | 'extra';
  status: 'pending' | 'paid' | null;
  notes: string | null;
}

interface ExportStats {
  totalShifts: number;
  totalHours: number;
  contractHours: number;
  extraHours: number;
  contractEarnings: number;
  extraEarnings: number;
  totalEarnings: number;
  paidContract: number;
  unpaidContract: number;
  paidExtra: number;
  unpaidExtra: number;
}

interface ExportOptions {
  shifts: ShiftData[];
  stats: ExportStats;
  userName: string;
  monthLabel: string;
}

export function exportToPDF({ shifts, stats, userName, monthLabel }: ExportOptions) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Riepilogo Turni', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`${userName}`, pageWidth / 2, 28, { align: 'center' });
  doc.text(`Periodo: ${monthLabel}`, pageWidth / 2, 35, { align: 'center' });
  doc.text(`Generato il: ${format(new Date(), 'dd MMMM yyyy HH:mm', { locale: it })}`, pageWidth / 2, 42, { align: 'center' });
  
  // Stats summary
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Riepilogo Statistiche', 14, 55);
  
  const statsData = [
    ['Turni Totali', String(stats.totalShifts)],
    ['Ore Totali', formatHours(stats.totalHours)],
    ['Ore Contratto', formatHours(stats.contractHours)],
    ['Ore Extra', formatHours(stats.extraHours)],
    ['Guadagno Contratto', formatCurrency(stats.contractEarnings)],
    ['Guadagno Extra', formatCurrency(stats.extraEarnings)],
    ['Guadagno Totale', formatCurrency(stats.totalEarnings)],
    ['Busta Pagato', formatCurrency(stats.paidContract)],
    ['Busta da Ricevere', formatCurrency(stats.unpaidContract)],
    ['Extra Pagati', formatCurrency(stats.paidExtra)],
    ['Extra da Ricevere', formatCurrency(stats.unpaidExtra)],
  ];
  
  autoTable(doc, {
    startY: 60,
    head: [['Statistica', 'Valore']],
    body: statsData,
    theme: 'striped',
    headStyles: { fillColor: [41, 98, 255] },
    styles: { fontSize: 10 },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'right' },
    },
  });
  
  // Shifts table
  const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Dettaglio Turni', 14, finalY);
  
  const shiftsTableData = shifts.map(shift => [
    format(new Date(shift.date), 'dd/MM/yyyy'),
    shift.start_time.slice(0, 5),
    shift.end_time.slice(0, 5),
    formatHours(shift.hours),
    shift.type === 'contract' ? 'Contratto' : 'Extra',
    shift.status === 'paid' ? 'Pagato' : 'In attesa',
    shift.notes || '-',
  ]);
  
  autoTable(doc, {
    startY: finalY + 5,
    head: [['Data', 'Entrata', 'Uscita', 'Ore', 'Tipo', 'Stato', 'Note']],
    body: shiftsTableData,
    theme: 'striped',
    headStyles: { fillColor: [41, 98, 255] },
    styles: { fontSize: 9 },
    columnStyles: {
      6: { cellWidth: 40 },
    },
  });
  
  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Pagina ${i} di ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }
  
  doc.save(`riepilogo-turni-${monthLabel.replace(/\s/g, '-').toLowerCase()}.pdf`);
}

export function exportToExcel({ shifts, stats, userName, monthLabel }: ExportOptions) {
  const workbook = XLSX.utils.book_new();
  
  // Stats sheet
  const statsSheetData = [
    ['Riepilogo Turni'],
    [''],
    ['Utente', userName],
    ['Periodo', monthLabel],
    ['Generato il', format(new Date(), 'dd/MM/yyyy HH:mm')],
    [''],
    ['STATISTICHE'],
    ['Turni Totali', stats.totalShifts],
    ['Ore Totali', stats.totalHours],
    ['Ore Contratto', stats.contractHours],
    ['Ore Extra', stats.extraHours],
    [''],
    ['GUADAGNI'],
    ['Guadagno Contratto', stats.contractEarnings],
    ['Guadagno Extra', stats.extraEarnings],
    ['Guadagno Totale', stats.totalEarnings],
    [''],
    ['STATO PAGAMENTI'],
    ['Busta Pagato', stats.paidContract],
    ['Busta da Ricevere', stats.unpaidContract],
    ['Extra Pagati', stats.paidExtra],
    ['Extra da Ricevere', stats.unpaidExtra],
  ];
  
  const statsSheet = XLSX.utils.aoa_to_sheet(statsSheetData);
  statsSheet['!cols'] = [{ wch: 20 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(workbook, statsSheet, 'Riepilogo');
  
  // Shifts sheet
  const shiftsSheetData = [
    ['Data', 'Entrata', 'Uscita', 'Ore', 'Ore (decimale)', 'Tipo', 'Stato', 'Note'],
    ...shifts.map(shift => [
      format(new Date(shift.date), 'dd/MM/yyyy'),
      shift.start_time.slice(0, 5),
      shift.end_time.slice(0, 5),
      formatHours(shift.hours),
      shift.hours,
      shift.type === 'contract' ? 'Contratto' : 'Extra',
      shift.status === 'paid' ? 'Pagato' : 'In attesa',
      shift.notes || '',
    ]),
  ];
  
  const shiftsSheet = XLSX.utils.aoa_to_sheet(shiftsSheetData);
  shiftsSheet['!cols'] = [
    { wch: 12 },
    { wch: 8 },
    { wch: 8 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(workbook, shiftsSheet, 'Turni');
  
  XLSX.writeFile(workbook, `riepilogo-turni-${monthLabel.replace(/\s/g, '-').toLowerCase()}.xlsx`);
}
