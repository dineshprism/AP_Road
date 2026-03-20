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
  const handleChange = (index: number, val: string) => {
    onChange({ ...values, [index.toString()]: val === "yes" });
  };

  return (
    <div className="space-y-3">
      <h4 className="font-semibold text-primary text-sm">{title}</h4>
      <div className="space-y-2">
        {items.map((item, index) => {
          const currentValue = values[index.toString()];
          const radioValue = currentValue === true ? "yes" : currentValue === false ? "no" : "";

          return (
            <div key={index} className="flex items-center justify-between gap-4 p-2 rounded hover:bg-muted/50">
              <span className="text-sm leading-tight font-normal flex-1">
                {index + 1}. {item}
              </span>
              <RadioGroup
                value={radioValue}
                onValueChange={(val) => handleChange(index, val)}
                className="flex items-center gap-4"
                disabled={readOnly}
              >
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="yes" id={`${title}-${index}-yes`} />
                  <Label htmlFor={`${title}-${index}-yes`} className="text-sm font-normal cursor-pointer">Yes</Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="no" id={`${title}-${index}-no`} />
                  <Label htmlFor={`${title}-${index}-no`} className="text-sm font-normal cursor-pointer">No</Label>
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
