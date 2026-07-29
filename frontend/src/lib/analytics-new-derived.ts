export type EnhancedLike = {
  summary: {
    totalAccidents: number;
    totalDeaths: number;
    totalInjuries: number;
    averageDeathsPerAccident: number;
    averageFatalityRate: number;
    totalVehicles: number;
    totalDrivers: number;
    averageVehiclesPerAccident: number;
    peakAccidentHour: string;
    peakAccidentMonth: string;
    mostDangerousRoadType: string;
    signedCopyUploaded: number;
    signedCopyPending: number;
  };
  trendData: Array<{ month: string; accidents: number; deaths: number; injuries: number; fatalityRate?: number }>;
  comparisonData: Array<{ name: string; accidents: number; deaths: number; injuries: number; fatalityRate: number; severity: string }>;
  mandalAnalysis: Array<{ name: string; accidents: number; deaths: number; injuries: number }>;
  roadTypeAnalysis: Array<{ roadType: string; accidents: number; deaths: number; injuries: number; fatalityRate: number; severityIndex?: number }>;
  roadTypeInsights: Record<string, unknown>;
  hotspotsLocations: Array<{ place: string; district: string; accidents: number; deaths: number; injured: number; severity: string; riskScore: number }>;
  policeStationAnalysis: Array<{ name: string; accidents: number; deaths: number; injuries: number; fatalityRate: number }>;
  dayOfWeekAnalysis: Array<{ day: string; accidents: number; deaths: number; injuries: number }>;
  vehicleAnalysis: Array<{ type: string; count: number; deaths: number; injuries: number }>;
  vehicleCauses: Array<{ cause: string; count: number; percentage: number }>;
  signedCopyAnalysis: Array<{ name: string; count: number }>;
  causeAnalysis: Array<{ cause: string; count: number; percentage: number; category: string }>;
  fieldCompleteness: Array<{ field: string; available: number; missing: number; coverage: number }>;
  geminiInsights: {
    riskFactors: string[];
    predictiveAnalysis: string;
  };
};

export type ProLike = {
  summary: {
    timelyRate: number;
    delayedSubmissions: number;
    averageLagHours: number;
  };
  districtRanking: Array<{ name: string; timelyRate: number; totalSubmissions: number; delayedSubmissions: number }>;
  stationRanking: Array<{ name: string; timelyRate: number; totalSubmissions: number }>;
  roadTimeliness: Array<{ name: string; timelyRate: number; totalSubmissions: number }>;
  weekdayPattern: Array<{ day: string; timely: number; delayed: number; total: number }>;
};

const NH_BUCKETS = ["NH", "SH", "MDR", "Other"];

export function findRoadTypeEntry(
  roadTypes: EnhancedLike["roadTypeAnalysis"],
  label: string
) {
  const normalized = label.toLowerCase();
  return roadTypes.find((item) => {
    const rt = item.roadType.toLowerCase();
    if (normalized === "other") return !["nh", "sh", "mdr"].some((k) => rt.includes(k));
    return rt.includes(normalized);
  });
}

export function buildNhShComparison(roadTypes: EnhancedLike["roadTypeAnalysis"]) {
  return NH_BUCKETS.map((roadType) => {
    const entry = findRoadTypeEntry(roadTypes, roadType);
    return {
      roadType,
      accidents: entry?.accidents || 0,
      deaths: entry?.deaths || 0,
      injuries: entry?.injuries || 0,
      fatalityRate: entry?.fatalityRate || 0,
    };
  });
}

export function buildNightDaySplit(
  timeAnalysis: Array<{ hour: string; accidents: number }> | undefined
) {
  let day = 0;
  let night = 0;
  (timeAnalysis || []).forEach((row) => {
    const hour = parseInt(String(row.hour).split(":")[0], 10);
    if (Number.isNaN(hour)) return;
    if (hour >= 6 && hour < 18) day += row.accidents;
    else night += row.accidents;
  });
  return { day, night, total: day + night };
}

export function buildDataQualityScore(fieldCompleteness: EnhancedLike["fieldCompleteness"]) {
  if (!fieldCompleteness.length) return 0;
  return Math.round(
    fieldCompleteness.reduce((sum, item) => sum + (item.coverage || 0), 0) / fieldCompleteness.length
  );
}

export function buildCasualtyIndex(summary: EnhancedLike["summary"]) {
  if (!summary.totalAccidents) return 0;
  return Number(
    ((summary.totalDeaths * 2 + summary.totalInjuries) / summary.totalAccidents).toFixed(2)
  );
}

export type ExecutiveAlert = {
  id: string;
  tone: "danger" | "warning" | "info" | "success";
  title: string;
  detail: string;
  actionLabel: string;
};

export function buildExecutiveAlerts(enhanced: EnhancedLike, pro: ProLike): ExecutiveAlert[] {
  const alerts: ExecutiveAlert[] = [];
  const topHotspot = enhanced.hotspotsLocations[0];
  const topDistrict = enhanced.comparisonData[0];
  const worstTimeliness = [...pro.districtRanking].sort((a, b) => a.timelyRate - b.timelyRate)[0];

  if (topHotspot) {
    alerts.push({
      id: "hotspot",
      tone: "danger",
      title: `Priority hotspot: ${topHotspot.place}`,
      detail: `${topHotspot.accidents} accidents, ${topHotspot.deaths} deaths in ${topHotspot.district}`,
      actionLabel: "View hotspot FIRs",
    });
  }

  if (topDistrict) {
    alerts.push({
      id: "district",
      tone: "warning",
      title: `Highest volume: ${topDistrict.name}`,
      detail: `${topDistrict.accidents} accidents · ${topDistrict.fatalityRate.toFixed(1)}% fatality rate`,
      actionLabel: "Open district cluster",
    });
  }

  if (pro.summary.delayedSubmissions > 0) {
    alerts.push({
      id: "delayed",
      tone: "warning",
      title: `${pro.summary.delayedSubmissions} delayed submissions`,
      detail: `Average reporting lag ${pro.summary.averageLagHours.toFixed(1)} hours`,
      actionLabel: "Review delayed FIRs",
    });
  }

  if (enhanced.summary.signedCopyPending > 0) {
    alerts.push({
      id: "signed",
      tone: "info",
      title: `${enhanced.summary.signedCopyPending} signed copies pending`,
      detail: "Compliance gap for verified accident records",
      actionLabel: "Pending signed copies",
    });
  }

  if (worstTimeliness && worstTimeliness.timelyRate < 70) {
    alerts.push({
      id: "timeliness",
      tone: "info",
      title: `Low timeliness: ${worstTimeliness.name}`,
      detail: `${worstTimeliness.timelyRate.toFixed(1)}% timely · ${worstTimeliness.delayedSubmissions} delayed`,
      actionLabel: "District reporting drill-down",
    });
  }

  return alerts.slice(0, 6);
}

export function buildRiskMatrix(comparisonData: EnhancedLike["comparisonData"]) {
  return comparisonData.slice(0, 15).map((row) => ({
    ...row,
    casualtyLoad: row.deaths * 2 + row.injuries,
    riskIndex: Number((row.accidents * 0.4 + row.deaths * 2 + row.injuries * 0.6).toFixed(1)),
  }));
}
