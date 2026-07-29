import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

interface InsightPanelProps {
  title: string;
  insights: string[];
  defaultOpen?: boolean;
}

export function InsightPanel({ title, insights, defaultOpen = true }: InsightPanelProps) {
  if (insights.length === 0) return null;

  return (
    <Accordion type="single" collapsible defaultValue={defaultOpen ? "insights" : undefined}>
      <AccordionItem value="insights" className="rounded-xl border border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-950">
        <AccordionTrigger className="py-3 text-sm font-bold hover:no-underline">
          <span className="flex items-center gap-2">
            {title}
            <Badge variant="secondary" className="rounded-full">{insights.length}</Badge>
          </span>
        </AccordionTrigger>
        <AccordionContent className="pb-4">
          <ul className="space-y-2 pl-4 text-sm leading-6 text-slate-700 dark:text-slate-300">
            {insights.map((insight, index) => (
              <li key={index} className="list-disc marker:text-blue-600">{insight}</li>
            ))}
          </ul>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
