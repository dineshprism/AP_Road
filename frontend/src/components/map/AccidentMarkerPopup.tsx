import { ExternalLink, MapPin } from "lucide-react";

export interface AccidentMarkerData {
  id: string;
  district: string;
  place_of_accident: string;
  fir_number: string;
  accident_date: string;
  accident_time: string;
  persons_died: number;
  persons_injured: number;
  lat: number;
  lng: number;
  severity: "high" | "medium" | "low";
}

const SEVERITY_LABELS = {
  high: { text: "Fatal accident", className: "bg-red-100 text-red-800" },
  medium: { text: "Injury accident", className: "bg-amber-100 text-amber-900" },
  low: { text: "Recorded incident", className: "bg-yellow-100 text-yellow-900" },
} as const;

export function AccidentMarkerPopup({ point }: { point: AccidentMarkerData }) {
  const severity = SEVERITY_LABELS[point.severity];

  return (
    <div className="min-w-[240px] max-w-[280px] font-sans">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {point.district}
          </p>
          <h4 className="mt-0.5 text-sm font-bold leading-snug text-slate-900">
            {point.place_of_accident}
          </h4>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${severity.className}`}>
          {severity.text}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-slate-600">
        <div>
          <dt className="font-medium text-slate-500">FIR</dt>
          <dd className="font-semibold text-slate-800">{point.fir_number}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Date</dt>
          <dd className="font-semibold text-slate-800">{point.accident_date}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Time</dt>
          <dd className="font-semibold text-slate-800">{point.accident_time}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Casualties</dt>
          <dd className="font-semibold text-slate-800">
            {point.persons_died} died · {point.persons_injured} injured
          </dd>
        </div>
      </dl>

      <a
        href={`https://www.openstreetmap.org/?mlat=${point.lat}&mlon=${point.lng}#map=16/${point.lat}/${point.lng}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
      >
        <MapPin className="h-3.5 w-3.5" />
        View on OpenStreetMap
        <ExternalLink className="h-3 w-3 opacity-70" />
      </a>
    </div>
  );
}
