import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface CausativeSectionProps {
  title: string;
  items: string[];
  values: Record<string, boolean>;
  onChange: (values: Record<string, boolean>) => void;
  readOnly?: boolean;
}

const CausativeSection = ({ title, items, values, onChange, readOnly }: CausativeSectionProps) => {
  const handleChange = (item: string, val: string) => {
    onChange({ ...values, [item]: val === "yes" });
  };

  return (
    <div className="space-y-3">
      <h4 className="font-semibold text-primary text-sm">{title}</h4>
      <div className="space-y-2">
        {items.map((item, index) => {
          const currentValue = values[item];
          const radioValue = currentValue === true ? "yes" : currentValue === false ? "no" : "";

          return (
            <div key={index} className="flex items-center justify-between gap-4 p-2 rounded hover:bg-muted/50">
              <span className="text-sm leading-tight font-normal flex-1">
                {index + 1}. {item}
              </span>
              <RadioGroup
                value={radioValue}
                onValueChange={(val) => handleChange(item, val)}
                className="flex items-center gap-4"
                disabled={readOnly}
              >
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="yes" id={`${title}-${index}-yes`} className={radioValue === "yes" ? "border-emerald-500 text-emerald-500" : ""} />
                  <Label htmlFor={`${title}-${index}-yes`} className={`text-sm font-medium cursor-pointer px-2 py-0.5 rounded ${radioValue === "yes" ? "bg-emerald-100 text-emerald-700" : "text-muted-foreground"}`}>Yes</Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="no" id={`${title}-${index}-no`} className={radioValue === "no" ? "border-rose-500 text-rose-500" : ""} />
                  <Label htmlFor={`${title}-${index}-no`} className={`text-sm font-medium cursor-pointer px-2 py-0.5 rounded ${radioValue === "no" ? "bg-rose-100 text-rose-700" : "text-muted-foreground"}`}>No</Label>
                </div>
              </RadioGroup>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CausativeSection;
