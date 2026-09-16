import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Section, InspectionItem } from '../types';

interface GeneratePdfOptions {
  roomNumber: string;
  roomType: string;
  inspectionDate: string;
  status: string;
  sections: Section[];
  itemsMap: Record<number, InspectionItem>;
  overallRemark: string;
  inspectorName: string;
  signatureUrl: string | null;
  verifiedByName?: string;
  verifiedAt?: string;
}

export function generateInspectionPdf(options: GeneratePdfOptions): void {
  const {
    roomNumber,
    roomType,
    inspectionDate,
    status,
    sections,
    itemsMap,
    overallRemark,
    inspectorName,
    signatureUrl,
    verifiedByName = 'Verified by Supervisor',
    verifiedAt,
  } = options;

  // Initialize A4 portrait document (210mm x 297mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;

  let currentY = margin;

  // Header Box
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(margin, currentY, contentWidth, 18, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(251, 191, 36); // amber-400
  doc.text('THE MAXWELL - INSPECTION LIST', pageWidth / 2, currentY + 7.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(226, 232, 240); // slate-200
  doc.text('PREVENTIVE MAINTENANCE INSPECTION REPORT', pageWidth / 2, currentY + 13, { align: 'center' });

  currentY += 22;

  // Metadata Table (Type, Room, Date, Status)
  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [],
    body: [
      [
        { content: 'Room Type:', styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [51, 65, 85] } },
        { content: roomType || 'N/A', styles: { textColor: [15, 23, 42] } },
        { content: 'Room Number:', styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [51, 65, 85] } },
        { content: `Room ${roomNumber}`, styles: { fontStyle: 'bold', textColor: [15, 23, 42] } },
      ],
      [
        { content: 'Inspection Date:', styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [51, 65, 85] } },
        { content: inspectionDate || new Date().toLocaleDateString(), styles: { textColor: [15, 23, 42] } },
        { content: 'Status:', styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [51, 65, 85] } },
        {
          content: status.toUpperCase(),
          styles: {
            fontStyle: 'bold',
            textColor: status === 'submitted' || status === 'verified' ? [22, 101, 52] : [180, 83, 9],
          },
        },
      ],
    ],
    styles: {
      fontSize: 8.5,
      cellPadding: 2.5,
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 32 },
      1: { cellWidth: 61 },
      2: { cellWidth: 32 },
      3: { cellWidth: 61 },
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 4;

  // Checklist Sections A to K
  sections.forEach((section) => {
    // Check if section requires a page break if too close to bottom
    if (currentY > pageHeight - 35) {
      doc.addPage();
      currentY = margin;
    }

    const tableRows = section.items.map((item) => {
      const ans = itemsMap[item.id];
      let resultText = '-';
      let resultStyle: { textColor: [number, number, number]; fontStyle?: 'bold' | 'normal' } = {
        textColor: [148, 163, 184],
      };

      if (ans?.result === 'pass') {
        resultText = 'PASS';
        resultStyle = { textColor: [22, 101, 52], fontStyle: 'bold' };
      } else if (ans?.result === 'fail') {
        resultText = 'FAIL';
        resultStyle = { textColor: [185, 28, 28], fontStyle: 'bold' };
      } else if (ans?.result === 'na') {
        resultText = 'N/A';
        resultStyle = { textColor: [100, 116, 139] };
      }

      return [
        { content: String(item.item_no), styles: { halign: 'center', textColor: [71, 85, 105] } },
        { content: item.description, styles: { textColor: [15, 23, 42] } },
        { content: resultText, styles: { halign: 'center', ...resultStyle } },
        { content: ans?.remark || '', styles: { textColor: ans?.result === 'fail' ? [185, 28, 28] : [71, 85, 105] } },
      ];
    });

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      theme: 'grid',
      head: [
        [
          {
            content: `${section.code}. ${section.title}`,
            colSpan: 4,
            styles: {
              fillColor: [30, 41, 59],
              textColor: [255, 255, 255],
              fontStyle: 'bold',
              fontSize: 8.5,
              cellPadding: 2,
            },
          },
        ],
        [
          { content: '#', styles: { halign: 'center', cellWidth: 10 } },
          { content: 'Checklist Item', styles: { cellWidth: 105 } },
          { content: 'Result', styles: { halign: 'center', cellWidth: 20 } },
          { content: 'Remarks / Defect Details', styles: { cellWidth: 51 } },
        ],
      ],
      body: tableRows as any,
      styles: {
        fontSize: 7.5,
        cellPadding: 1.8,
        lineColor: [226, 232, 240],
        lineWidth: 0.15,
        valign: 'middle',
      },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [51, 65, 85],
        fontStyle: 'bold',
        fontSize: 7.5,
        lineColor: [203, 213, 225],
        lineWidth: 0.2,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      pageBreak: 'auto',
    });

    currentY = (doc as any).lastAutoTable.finalY + 3;
  });

  // Overall remarks if present
  if (overallRemark && overallRemark.trim().length > 0) {
    if (currentY > pageHeight - 45) {
      doc.addPage();
      currentY = margin;
    }

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      theme: 'grid',
      head: [
        [
          {
            content: 'OVERALL REMARKS & MAINTENANCE NOTES',
            styles: {
              fillColor: [241, 245, 249],
              textColor: [15, 23, 42],
              fontStyle: 'bold',
              fontSize: 8,
            },
          },
        ],
      ],
      body: [
        [
          {
            content: overallRemark,
            styles: {
              fontSize: 8,
              cellPadding: 3,
              textColor: [30, 41, 59],
            },
          },
        ],
      ],
    });

    currentY = (doc as any).lastAutoTable.finalY + 4;
  }

  // Footer Signatures Box
  if (currentY > pageHeight - 40) {
    doc.addPage();
    currentY = margin;
  }

  const signTableStartY = currentY;

  autoTable(doc, {
    startY: signTableStartY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [
      [
        { content: 'Date', styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [51, 65, 85] } },
        { content: 'Inspected By', styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [51, 65, 85] } },
        { content: 'Verified By', styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [51, 65, 85] } },
      ],
    ],
    body: [
      [
        {
          content: `${inspectionDate}\n\nOfficial Submission Record`,
          styles: { minCellHeight: 22, fontSize: 8, textColor: [30, 41, 59] },
        },
        {
          content: signatureUrl ? `\n\n\n${inspectorName}` : `\n\n${inspectorName}\n(Digital Sign-off)`,
          styles: { minCellHeight: 22, fontSize: 8, textColor: [30, 41, 59] },
        },
        {
          content: `${verifiedByName}\n${verifiedAt || inspectionDate}\nEngineering Supervisor`,
          styles: { minCellHeight: 22, fontSize: 8, textColor: [30, 41, 59] },
        },
      ],
    ],
    styles: {
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 76 },
      2: { cellWidth: 55 },
    },
  });

  // If signature image is present (base64 or data url), draw it in the middle cell
  if (signatureUrl && (signatureUrl.startsWith('data:image') || signatureUrl.startsWith('blob:'))) {
    try {
      const cellTop = signTableStartY + 7; // after header row
      const imgX = margin + 55 + 5;
      const imgY = cellTop + 1;
      const imgWidth = 40;
      const imgHeight = 12;

      doc.addImage(signatureUrl, 'PNG', imgX, imgY, imgWidth, imgHeight);
    } catch (e) {
      console.warn('Could not embed signature image in PDF', e);
    }
  }

  // Add Page Numbers & Footers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(
      `Maxwell Hotel & Suites • Preventive Maintenance Inspection • Room ${roomNumber}`,
      margin,
      pageHeight - 6
    );
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
  }

  // Download PDF
  const safeFilename = `Maxwell_Inspection_Room_${roomNumber.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(safeFilename);
}
