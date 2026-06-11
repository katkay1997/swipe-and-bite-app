import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export const DIETARY = [
  "Vegetarian",
  "Vegan",
  "Pescatarian",
  "Halal",
  "Kosher",
  "Gluten-free",
  "Dairy-free",
  "Keto",
  "Low-carb",
];
export const ALLERGENS = [
  "Peanuts",
  "Tree nuts",
  "Shellfish",
  "Fish",
  "Eggs",
  "Dairy",
  "Soy",
  "Wheat",
  "Sesame",
];
export const HEALTH_GLP1_OPTION = "On a GLP-1 (Ozempic, Wegovy, Mounjaro)";
export const HEALTH = [
  "None",
  "Diabetes",
  "Pre-diabetes",
  "Pregnancy",
  "Breastfeeding",
  "High blood pressure",
  "High cholesterol",
  "Heart condition",
  "IBS",
  "Crohn's / Colitis",
  "Kidney condition",
  "Thyroid condition",
  "PCOS",
  "Acid reflux / GERD",
  HEALTH_GLP1_OPTION,
];
export const GOALS = [
  "Lose weight",
  "Eat balanced",
  "Save money",
  "Try new things",
];

export function CheckGroup({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {options.map((o) => {
        const checked = value.includes(o);
        return (
          <button
            type="button"
            key={o}
            onClick={() =>
              onChange(checked ? value.filter((x) => x !== o) : [...value, o])
            }
            className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-left text-sm transition-colors ${
              checked
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/50"
            }`}
          >
            <span
              className={`grid h-5 w-5 place-items-center rounded-full border ${
                checked
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border"
              }`}
            >
              {checked && <Check size={12} />}
            </span>
            {o}
          </button>
        );
      })}
    </div>
  );
}

export function OtherInput({
  id,
  value,
  onChange,
  placeholder,
  label = "Something not listed? Tell us:",
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label?: string;
}) {
  return (
    <div className="mt-4">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1"
      />
    </div>
  );
}

export function GoalRadio({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <RadioGroup value={value} onValueChange={onChange}>
      {GOALS.map((g) => (
        <label
          key={g}
          className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3 hover:bg-accent"
        >
          <RadioGroupItem value={g} />
          <span className="text-sm">{g}</span>
        </label>
      ))}
    </RadioGroup>
  );
}

export function Glp1Toggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border p-4">
      <Checkbox
        checked={value}
        onCheckedChange={(v) => onChange(Boolean(v))}
      />
      <span>Yes, I'm taking a GLP-1</span>
    </label>
  );
}
