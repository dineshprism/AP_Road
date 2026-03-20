import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, Header, Footer,
  HeadingLevel, ShadingType,
} from "docx";
import { saveAs } from "file-saver";
import {
  DRIVER_RELATED_CAUSES, VEHICLE_CONDITION_CAUSES,
  ROAD_CULVERTS_CAUSES, ROAD_JUNCTIONS_CAUSES,
  ROAD_MEDIAN_CAUSES, ROAD_NATURE_CAUSES, ROAD_SIGNAGES_CAUSES,
} from "@/lib/constants";

const HEADER_LINE1 = "GOVERNMENT OF ANDHRA PRADESH — POLICE, TRANSPORT, ROADS & BUILDINGS DEPARTMENT";
const HEADER_LINE2 = "Fatal Road Accident — Scientific Investigation Report";
const HEADER_LINE3 = "G.O.Ms.No.42 Dated: 11/10/2019  |  Section 135, MV Act 1988";
const FOOTER_TEXT = "For Official Use Only  |  District Road Safety Committee (DRSC)  |  AP Police — District Traffic Records Bureau";

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
  prepared_by_name: string | null;
  prepared_by_designation: string | null;
  prepared_by_date: string | null;
  verified_by_name: string | null;
  verified_by_designation: string | null;
  verified_by_date: string | null;
  approved_by_name: string | null;
  approved_by_designation: string | null;
  approved_by_date: string | null;
  [key: string]: any;
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-IN"); } catch { return d; }
}

function causesList(items: string[], values: Record<string, boolean>): string[] {
  return items.filter((item) => values?.[item]);
}

// ─── PDF Export ──────────────────────────────────────────────────────────────

export function exportSubmissionPDF(s: Submission) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = 12;

  const addHeaderFooter = (doc: jsPDF) => {
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      // Header
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text(HEADER_LINE1, pageWidth / 2, 8, { align: "center" });
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text(`${HEADER_LINE2}  |  ${HEADER_LINE3}`, pageWidth / 2, 12, { align: "center" });
      doc.setDrawColor(0, 51, 102);
      doc.setLineWidth(0.5);
      doc.line(margin, 14, pageWidth - margin, 14);

      // Footer
      doc.setDrawColor(0, 51, 102);
      doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "italic");
      doc.text(FOOTER_TEXT, pageWidth / 2, pageHeight - 8, { align: "center" });
      doc.text(`Page ${i} of ${pages}`, pageWidth - margin, pageHeight - 8, { align: "right" });
    }
  };

  const checkPage = (needed: number) => {
    if (y + needed > pageHeight - 18) {
      doc.addPage();
      y = 18;
    }
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
    doc.text(label + ":", margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(value ?? "—"), margin + 55, y);
    y += 5;
  };

  // Title
  y = 18;
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 51, 102);
  doc.text("ANNEXURE — Submission Report", pageWidth / 2, y, { align: "center" });
  y += 5;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(`District: ${s.district}  |  FIR: ${s.fir_number}  |  Road: ${s.road_type}`, pageWidth / 2, y, { align: "center" });
  y += 8;
  doc.setTextColor(0, 0, 0);

  // A. Location
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

  // B. Vehicles
  sectionTitle("B. Vehicles Involved");
  const vehicles = Array.isArray(s.vehicles) ? s.vehicles : [];
  if (vehicles.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["#", "Registration Number", "Class / Type"]],
      body: vehicles.map((v, i) => [i + 1, v.registration_number || "—", v.class_type || "—"]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [0, 51, 102], textColor: 255 },
      theme: "grid",
    });
    y = (doc as any).lastAutoTable.finalY + 5;
  }

  // C. Drivers
  sectionTitle("C. Driver Details");
  const drivers = Array.isArray(s.drivers) ? s.drivers : [];
  if (drivers.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["#", "Name", "D.L Number", "Licensing Authority"]],
      body: drivers.map((d, i) => [i + 1, d.name || "—", d.dl_number || "—", d.licensing_authority || "—"]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [0, 51, 102], textColor: 255 },
      theme: "grid",
    });
    y = (doc as any).lastAutoTable.finalY + 5;
  }

  // D. Victims
  sectionTitle("D. Victim Details");
  infoRow("Persons Died", s.persons_died);
  infoRow("Persons Injured", s.persons_injured);
  y += 3;

  // Causative Analysis
  sectionTitle("CAUSATIVE ANALYSIS");

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
      checkPage(6);
      doc.text(`• ${cause}`, margin + 3, y);
      const lines = doc.splitTextToSize(`• ${cause}`, pageWidth - 2 * margin - 3);
      y += lines.length * 4;
    });
    y += 2;
  };

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

  // Approval Chain
  sectionTitle("Approval Chain");
  autoTable(doc, {
    startY: y,
    head: [["", "Prepared by (IO/SHO)", "Verified by (DSP/CI)", "Approved by (SP/Addl. SP)"]],
    body: [
      ["Name", s.prepared_by_name || "—", s.verified_by_name || "—", s.approved_by_name || "—"],
      ["Designation", s.prepared_by_designation || "—", s.verified_by_designation || "—", s.approved_by_designation || "—"],
      ["Date", fmtDate(s.prepared_by_date), fmtDate(s.verified_by_date), fmtDate(s.approved_by_date)],
    ],
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [0, 51, 102], textColor: 255 },
    theme: "grid",
  });

  addHeaderFooter(doc);
  doc.save(`FIR_${s.fir_number}_${s.district}.pdf`);
}

// ─── DOCX Export ─────────────────────────────────────────────────────────────

function docxInfoRow(label: string, value: string | number | null): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 35, type: WidthType.PERCENTAGE },
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 18, font: "Arial" })] })],
        shading: { type: ShadingType.SOLID, color: "F0F4F8" },
      }),
      new TableCell({
        width: { size: 65, type: WidthType.PERCENTAGE },
        children: [new Paragraph({ children: [new TextRun({ text: String(value ?? "—"), size: 18, font: "Arial" })] })],
      }),
    ],
  });
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
            children: [new TextRun({ text: `• ${cause}`, size: 17, font: "Arial" })],
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
          // Title
          new Paragraph({
            children: [new TextRun({ text: "ANNEXURE — Submission Report", bold: true, size: 28, font: "Arial", color: "003366" })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
          }),
          new Paragraph({
            children: [new TextRun({ text: `District: ${s.district}  |  FIR: ${s.fir_number}  |  Road: ${s.road_type}`, size: 18, font: "Arial", color: "555555" })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),

          // A. Location
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

          // B. Vehicles
          sectionTitle("B. Vehicles Involved"),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: borderStyle,
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "#", bold: true, size: 18, font: "Arial", color: "FFFFFF" })] })], shading: { type: ShadingType.SOLID, color: "003366" }, width: { size: 10, type: WidthType.PERCENTAGE } }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Registration", bold: true, size: 18, font: "Arial", color: "FFFFFF" })] })], shading: { type: ShadingType.SOLID, color: "003366" }, width: { size: 45, type: WidthType.PERCENTAGE } }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Class / Type", bold: true, size: 18, font: "Arial", color: "FFFFFF" })] })], shading: { type: ShadingType.SOLID, color: "003366" }, width: { size: 45, type: WidthType.PERCENTAGE } }),
                ],
              }),
              ...vehicles.map(
                (v, i) =>
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(i + 1), size: 18, font: "Arial" })] })] }),
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: v.registration_number || "—", size: 18, font: "Arial" })] })] }),
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: v.class_type || "—", size: 18, font: "Arial" })] })] }),
                    ],
                  })
              ),
            ],
          }),

          // C. Drivers
          sectionTitle("C. Driver Details"),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: borderStyle,
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "#", bold: true, size: 18, font: "Arial", color: "FFFFFF" })] })], shading: { type: ShadingType.SOLID, color: "003366" }, width: { size: 8, type: WidthType.PERCENTAGE } }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Name", bold: true, size: 18, font: "Arial", color: "FFFFFF" })] })], shading: { type: ShadingType.SOLID, color: "003366" }, width: { size: 30, type: WidthType.PERCENTAGE } }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "D.L Number", bold: true, size: 18, font: "Arial", color: "FFFFFF" })] })], shading: { type: ShadingType.SOLID, color: "003366" }, width: { size: 30, type: WidthType.PERCENTAGE } }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Licensing Authority", bold: true, size: 18, font: "Arial", color: "FFFFFF" })] })], shading: { type: ShadingType.SOLID, color: "003366" }, width: { size: 32, type: WidthType.PERCENTAGE } }),
                ],
              }),
              ...drivers.map(
                (d, i) =>
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(i + 1), size: 18, font: "Arial" })] })] }),
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: d.name || "—", size: 18, font: "Arial" })] })] }),
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: d.dl_number || "—", size: 18, font: "Arial" })] })] }),
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: d.licensing_authority || "—", size: 18, font: "Arial" })] })] }),
                    ],
                  })
              ),
            ],
          }),

          // D. Victims
          sectionTitle("D. Victim Details"),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: borderStyle,
            rows: [
              docxInfoRow("Persons Died", s.persons_died),
              docxInfoRow("Persons Injured", s.persons_injured),
            ],
          }),

          // Causative Analysis
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

          // Approval Chain
          sectionTitle("Approval Chain"),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: borderStyle,
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "", size: 18 })] })], shading: { type: ShadingType.SOLID, color: "003366" }, width: { size: 20, type: WidthType.PERCENTAGE } }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Prepared by (IO/SHO)", bold: true, size: 18, font: "Arial", color: "FFFFFF" })] })], shading: { type: ShadingType.SOLID, color: "003366" } }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Verified by (DSP/CI)", bold: true, size: 18, font: "Arial", color: "FFFFFF" })] })], shading: { type: ShadingType.SOLID, color: "003366" } }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Approved by (SP/Addl. SP)", bold: true, size: 18, font: "Arial", color: "FFFFFF" })] })], shading: { type: ShadingType.SOLID, color: "003366" } }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Name", bold: true, size: 18, font: "Arial" })] })], shading: { type: ShadingType.SOLID, color: "F0F4F8" } }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: s.prepared_by_name || "—", size: 18, font: "Arial" })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: s.verified_by_name || "—", size: 18, font: "Arial" })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: s.approved_by_name || "—", size: 18, font: "Arial" })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Designation", bold: true, size: 18, font: "Arial" })] })], shading: { type: ShadingType.SOLID, color: "F0F4F8" } }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: s.prepared_by_designation || "—", size: 18, font: "Arial" })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: s.verified_by_designation || "—", size: 18, font: "Arial" })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: s.approved_by_designation || "—", size: 18, font: "Arial" })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Date", bold: true, size: 18, font: "Arial" })] })], shading: { type: ShadingType.SOLID, color: "F0F4F8" } }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: fmtDate(s.prepared_by_date), size: 18, font: "Arial" })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: fmtDate(s.verified_by_date), size: 18, font: "Arial" })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: fmtDate(s.approved_by_date), size: 18, font: "Arial" })] })] }),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `FIR_${s.fir_number}_${s.district}.docx`);
}
