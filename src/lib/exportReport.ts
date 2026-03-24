import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { saveAs } from "file-saver";
import {
  DRIVER_RELATED_CAUSES,
  ROAD_CULVERTS_CAUSES,
  ROAD_JUNCTIONS_CAUSES,
  ROAD_MEDIAN_CAUSES,
  ROAD_NATURE_CAUSES,
  ROAD_SIGNAGES_CAUSES,
  VEHICLE_CONDITION_CAUSES,
} from "@/lib/constants";

const HEADER_LINE1 = "GOVERNMENT OF ANDHRA PRADESH - POLICE, TRANSPORT, ROADS & BUILDINGS DEPARTMENT";
const HEADER_LINE2 = "Fatal Road Accident - Scientific Investigation Report";
const HEADER_LINE3 = "G.O.Ms.No.42 Dated: 11/10/2019  |  Section 135, MV Act 1988";
const FOOTER_TEXT = "For Official Use Only  |  District Road Safety Committee (DRSC)  |  AP Police - District Traffic Records Bureau";

interface Submission {
  id: string;
  district: string;
  place_of_accident: string;
  mandal: string;
  police_station: string;
  fir_number: string;
  lat_long: string | null;
  road_type: string;
  accident_date: string;
  accident_time: string;
  persons_died: number;
  persons_injured: number;
  vehicles: { registration_number: string; class_type: string }[];
  drivers: { name: string; dl_number: string; licensing_authority: string }[];
  driver_related_causes: Record<string, boolean>;
  vehicle_condition_causes: Record<string, boolean>;
  road_engineering_culverts: Record<string, boolean>;
  road_engineering_junctions: Record<string, boolean>;
  road_engineering_median: Record<string, boolean>;
  road_engineering_nature: Record<string, boolean>;
  road_engineering_signages: Record<string, boolean>;
  [key: string]: any;
}

function fmtDate(value: string | null): string {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString("en-IN");
  } catch {
    return value;
  }
}

function causesList(items: string[], values: Record<string, boolean>): string[] {
  return items.filter((item) => values?.[item]);
}

function drawSignatureBlocks(doc: jsPDF, startY: number, margin: number, pageWidth: number) {
  const labels = [
    "Prepared by (IO / SHO)",
    "Verified by (DSP / CI)",
    "Approved by (SP / Addl. SP)",
  ];
  const gap = 6;
  const width = (pageWidth - margin * 2 - gap * 2) / 3;
  const height = 34;

  labels.forEach((label, index) => {
    const x = margin + index * (width + gap);
    doc.setDrawColor(186, 194, 204);
    doc.setFillColor(250, 251, 253);
    doc.roundedRect(x, startY, width, height, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(label, x + 3, startY + 5);
    doc.setDrawColor(214, 220, 228);
    doc.rect(x + 3, startY + 8, width - 6, 19);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.line(x + 3, startY + 30, x + width - 3, startY + 30);
    doc.text("Signature / Stamp", x + 3, startY + 33);
  });

  return startY + height + 3;
}

function docxInfoRow(label: string, value: string | number | null): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 35, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.SOLID, color: "F0F4F8" },
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 18, font: "Arial" })] })],
      }),
      new TableCell({
        width: { size: 65, type: WidthType.PERCENTAGE },
        children: [new Paragraph({ children: [new TextRun({ text: String(value ?? "-"), size: 18, font: "Arial" })] })],
      }),
    ],
  });
}

function docxSignatureTable(borderStyle: any) {
  const labels = [
    "Prepared by (IO / SHO)",
    "Verified by (DSP / CI)",
    "Approved by (SP / Addl. SP)",
  ];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: borderStyle,
    rows: [
      new TableRow({
        children: labels.map((label) =>
          new TableCell({
            width: { size: 33.33, type: WidthType.PERCENTAGE },
            borders: borderStyle,
            shading: { type: ShadingType.SOLID, color: "FAFBFD" },
            children: [
              new Paragraph({
                children: [new TextRun({ text: label, bold: true, size: 18, font: "Arial", color: "003366" })],
                spacing: { after: 140 },
              }),
              new Paragraph({ children: [new TextRun({ text: " ", size: 18, font: "Arial" })], spacing: { after: 140 } }),
              new Paragraph({ children: [new TextRun({ text: " ", size: 18, font: "Arial" })], spacing: { after: 140 } }),
              new Paragraph({ children: [new TextRun({ text: " ", size: 18, font: "Arial" })], spacing: { after: 140 } }),
              new Paragraph({
                children: [new TextRun({ text: "______________________________", size: 18, font: "Arial" })],
                spacing: { before: 120, after: 60 },
              }),
              new Paragraph({
                children: [new TextRun({ text: "Signature / Stamp", size: 16, font: "Arial", color: "666666" })],
              }),
            ],
          })
        ),
      }),
    ],
  });
}

export function exportSubmissionPDF(s: Submission) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = 18;

  const addHeaderFooter = () => {
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i += 1) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text(HEADER_LINE1, pageWidth / 2, 8, { align: "center" });
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text(`${HEADER_LINE2}  |  ${HEADER_LINE3}`, pageWidth / 2, 12, { align: "center" });
      doc.setDrawColor(0, 51, 102);
      doc.setLineWidth(0.5);
      doc.line(margin, 14, pageWidth - margin, 14);
      doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "italic");
      doc.text(FOOTER_TEXT, pageWidth / 2, pageHeight - 8, { align: "center" });
      doc.text(`Page ${i} of ${pages}`, pageWidth - margin, pageHeight - 8, { align: "right" });
    }
  };

  const checkPage = (needed: number) => {
    if (y + needed <= pageHeight - 18) return;
    doc.addPage();
    y = 18;
  };

  const sectionTitle = (title: string) => {
    checkPage(12);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 51, 102);
    doc.text(title, margin, y);
    y += 1;
    doc.setDrawColor(0, 102, 51);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
    doc.setTextColor(0, 0, 0);
  };

  const infoRow = (label: string, value: string | number | null) => {
    checkPage(7);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(value ?? "-"), margin + 55, y);
    y += 5;
  };

  const renderCauses = (title: string, items: string[], values: Record<string, boolean>) => {
    const selected = causesList(items, values);
    if (selected.length === 0) return;
    checkPage(10);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.text(title, margin, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    selected.forEach((cause) => {
      const line = `* ${cause}`;
      const lines = doc.splitTextToSize(line, pageWidth - 2 * margin - 3);
      checkPage(lines.length * 4 + 2);
      doc.text(lines, margin + 3, y);
      y += lines.length * 4;
    });
    y += 2;
  };

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 51, 102);
  doc.text("ANNEXURE - Submission Report", pageWidth / 2, y, { align: "center" });
  y += 5;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(`District: ${s.district}  |  FIR: ${s.fir_number}  |  Road: ${s.road_type}`, pageWidth / 2, y, { align: "center" });
  y += 8;
  doc.setTextColor(0, 0, 0);

  sectionTitle("A. Location Details");
  infoRow("Place of Accident", s.place_of_accident);
  infoRow("Mandal", s.mandal);
  infoRow("Police Station", s.police_station);
  infoRow("FIR Number", s.fir_number);
  infoRow("GPS Coordinates", s.lat_long);
  infoRow("Road Type", s.road_type);
  infoRow("Date", fmtDate(s.accident_date));
  infoRow("Time", s.accident_time);
  y += 3;

  sectionTitle("B. Vehicles Involved");
  const vehicles = Array.isArray(s.vehicles) ? s.vehicles : [];
  if (vehicles.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["#", "Registration Number", "Class / Type"]],
      body: vehicles.map((vehicle, index) => [index + 1, vehicle.registration_number || "-", vehicle.class_type || "-"]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [0, 51, 102], textColor: 255 },
      theme: "grid",
    });
    y = (doc as any).lastAutoTable.finalY + 5;
  }

  sectionTitle("C. Driver Details");
  const drivers = Array.isArray(s.drivers) ? s.drivers : [];
  if (drivers.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["#", "Name", "D.L Number", "Licensing Authority"]],
      body: drivers.map((driver, index) => [index + 1, driver.name || "-", driver.dl_number || "-", driver.licensing_authority || "-"]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [0, 51, 102], textColor: 255 },
      theme: "grid",
    });
    y = (doc as any).lastAutoTable.finalY + 5;
  }

  sectionTitle("D. Victim Details");
  infoRow("Persons Died", s.persons_died);
  infoRow("Persons Injured", s.persons_injured);
  y += 3;

  sectionTitle("CAUSATIVE ANALYSIS");
  renderCauses("A. Driver Related Causes", DRIVER_RELATED_CAUSES, s.driver_related_causes || {});
  renderCauses("B. Vehicle Condition Related Causes", VEHICLE_CONDITION_CAUSES, s.vehicle_condition_causes || {});
  checkPage(8);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 51, 102);
  doc.text("C. Road Engineering Related Factors", margin, y);
  y += 5;
  doc.setTextColor(0, 0, 0);
  renderCauses("Culverts and Curves", ROAD_CULVERTS_CAUSES, s.road_engineering_culverts || {});
  renderCauses("Junctions", ROAD_JUNCTIONS_CAUSES, s.road_engineering_junctions || {});
  renderCauses("Median", ROAD_MEDIAN_CAUSES, s.road_engineering_median || {});
  renderCauses("Nature of Area", ROAD_NATURE_CAUSES, s.road_engineering_nature || {});
  renderCauses("Signages and Road Markings", ROAD_SIGNAGES_CAUSES, s.road_engineering_signages || {});

  sectionTitle("Signatures and Seal");
  checkPage(42);
  y = drawSignatureBlocks(doc, y, margin, pageWidth);

  addHeaderFooter();
  doc.save(`FIR_${s.fir_number}_${s.district}.pdf`);
}

export async function exportSubmissionDOCX(s: Submission) {
  const vehicles = Array.isArray(s.vehicles) ? s.vehicles : [];
  const drivers = Array.isArray(s.drivers) ? s.drivers : [];

  const borderStyle = {
    top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
  };

  const sectionTitle = (text: string) =>
    new Paragraph({
      children: [new TextRun({ text, bold: true, size: 22, font: "Arial", color: "003366" })],
      spacing: { before: 300, after: 100 },
      heading: HeadingLevel.HEADING_2,
      border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "006633" } },
    });

  const causesSection = (title: string, items: string[], values: Record<string, boolean>): Paragraph[] => {
    const selected = causesList(items, values);
    if (selected.length === 0) return [];
    return [
      new Paragraph({
        children: [new TextRun({ text: title, bold: true, size: 19, font: "Arial" })],
        spacing: { before: 200, after: 80 },
      }),
      ...selected.map(
        (cause) =>
          new Paragraph({
            children: [new TextRun({ text: `* ${cause}`, size: 17, font: "Arial" })],
            spacing: { after: 40 },
            indent: { left: 300 },
          })
      ),
    ];
  };

  const doc = new Document({
    sections: [
      {
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [new TextRun({ text: HEADER_LINE1, bold: true, size: 16, font: "Arial", color: "003366" })],
                alignment: AlignmentType.CENTER,
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: HEADER_LINE2, size: 15, font: "Arial" }),
                  new TextRun({ text: `  |  ${HEADER_LINE3}`, size: 14, font: "Arial", color: "555555" }),
                ],
                alignment: AlignmentType.CENTER,
                border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "003366" } },
                spacing: { after: 100 },
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [new TextRun({ text: FOOTER_TEXT, italics: true, size: 14, font: "Arial", color: "666666" })],
                alignment: AlignmentType.CENTER,
                border: { top: { style: BorderStyle.SINGLE, size: 2, color: "003366" } },
                spacing: { before: 100 },
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            children: [new TextRun({ text: "ANNEXURE - Submission Report", bold: true, size: 28, font: "Arial", color: "003366" })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
          }),
          new Paragraph({
            children: [new TextRun({ text: `District: ${s.district}  |  FIR: ${s.fir_number}  |  Road: ${s.road_type}`, size: 18, font: "Arial", color: "555555" })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),

          sectionTitle("A. Location Details"),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: borderStyle,
            rows: [
              docxInfoRow("Place of Accident", s.place_of_accident),
              docxInfoRow("Mandal", s.mandal),
              docxInfoRow("Police Station", s.police_station),
              docxInfoRow("FIR Number", s.fir_number),
              docxInfoRow("GPS Coordinates", s.lat_long),
              docxInfoRow("Road Type", s.road_type),
              docxInfoRow("Date", fmtDate(s.accident_date)),
              docxInfoRow("Time", s.accident_time),
            ],
          }),

          sectionTitle("B. Vehicles Involved"),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: borderStyle,
            rows: [
              new TableRow({
                children: [
                  new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.SOLID, color: "003366" }, children: [new Paragraph({ children: [new TextRun({ text: "#", bold: true, size: 18, font: "Arial", color: "FFFFFF" })] })] }),
                  new TableCell({ width: { size: 45, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.SOLID, color: "003366" }, children: [new Paragraph({ children: [new TextRun({ text: "Registration", bold: true, size: 18, font: "Arial", color: "FFFFFF" })] })] }),
                  new TableCell({ width: { size: 45, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.SOLID, color: "003366" }, children: [new Paragraph({ children: [new TextRun({ text: "Class / Type", bold: true, size: 18, font: "Arial", color: "FFFFFF" })] })] }),
                ],
              }),
              ...vehicles.map(
                (vehicle, index) =>
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(index + 1), size: 18, font: "Arial" })] })] }),
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: vehicle.registration_number || "-", size: 18, font: "Arial" })] })] }),
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: vehicle.class_type || "-", size: 18, font: "Arial" })] })] }),
                    ],
                  })
              ),
            ],
          }),

          sectionTitle("C. Driver Details"),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: borderStyle,
            rows: [
              new TableRow({
                children: [
                  new TableCell({ width: { size: 8, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.SOLID, color: "003366" }, children: [new Paragraph({ children: [new TextRun({ text: "#", bold: true, size: 18, font: "Arial", color: "FFFFFF" })] })] }),
                  new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.SOLID, color: "003366" }, children: [new Paragraph({ children: [new TextRun({ text: "Name", bold: true, size: 18, font: "Arial", color: "FFFFFF" })] })] }),
                  new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.SOLID, color: "003366" }, children: [new Paragraph({ children: [new TextRun({ text: "D.L Number", bold: true, size: 18, font: "Arial", color: "FFFFFF" })] })] }),
                  new TableCell({ width: { size: 32, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.SOLID, color: "003366" }, children: [new Paragraph({ children: [new TextRun({ text: "Licensing Authority", bold: true, size: 18, font: "Arial", color: "FFFFFF" })] })] }),
                ],
              }),
              ...drivers.map(
                (driver, index) =>
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(index + 1), size: 18, font: "Arial" })] })] }),
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: driver.name || "-", size: 18, font: "Arial" })] })] }),
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: driver.dl_number || "-", size: 18, font: "Arial" })] })] }),
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: driver.licensing_authority || "-", size: 18, font: "Arial" })] })] }),
                    ],
                  })
              ),
            ],
          }),

          sectionTitle("D. Victim Details"),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: borderStyle,
            rows: [
              docxInfoRow("Persons Died", s.persons_died),
              docxInfoRow("Persons Injured", s.persons_injured),
            ],
          }),

          sectionTitle("CAUSATIVE ANALYSIS"),
          ...causesSection("A. Driver Related Causes", DRIVER_RELATED_CAUSES, s.driver_related_causes || {}),
          ...causesSection("B. Vehicle Condition Related Causes", VEHICLE_CONDITION_CAUSES, s.vehicle_condition_causes || {}),
          new Paragraph({
            children: [new TextRun({ text: "C. Road Engineering Related Factors", bold: true, size: 20, font: "Arial", color: "003366" })],
            spacing: { before: 250, after: 100 },
          }),
          ...causesSection("Culverts and Curves", ROAD_CULVERTS_CAUSES, s.road_engineering_culverts || {}),
          ...causesSection("Junctions", ROAD_JUNCTIONS_CAUSES, s.road_engineering_junctions || {}),
          ...causesSection("Median", ROAD_MEDIAN_CAUSES, s.road_engineering_median || {}),
          ...causesSection("Nature of Area", ROAD_NATURE_CAUSES, s.road_engineering_nature || {}),
          ...causesSection("Signages and Road Markings", ROAD_SIGNAGES_CAUSES, s.road_engineering_signages || {}),

          sectionTitle("Signatures and Seal"),
          docxSignatureTable(borderStyle),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `FIR_${s.fir_number}_${s.district}.docx`);
}
