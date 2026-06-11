import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/legal/disclaimer")({
  head: () => ({
    meta: [{ title: "Health disclaimer — SwipeBite" }],
  }),
  component: Disclaimer,
});

function Disclaimer() {
  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-soft)" }}>
      <header className="mx-auto flex max-w-2xl items-center justify-between px-6 py-5">
        <Logo />
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">Home</Link>
      </header>
      <main className="mx-auto max-w-2xl px-6 pb-12">
        <div className="rounded-3xl bg-card p-7 prose prose-sm max-w-none" style={{ boxShadow: "var(--shadow-card)" }}>
          <h1 className="text-2xl font-bold">Health disclaimer</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            SwipeBite provides meal suggestions and informational tags (e.g. "iron-rich",
            "pregnancy-safe preparation", "GLP-1 friendly") for general guidance only. These tags
            are <strong>not medical advice</strong> and are not a substitute for consultation with a
            qualified healthcare professional.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            If you have allergies, dietary restrictions, a medical condition, or are pregnant or
            nursing, please verify ingredients and preparation methods independently and consult
            your doctor or a registered dietitian before changing your diet.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Nutrition values shown are estimates from third-party sources and may differ from the
            actual prepared meal.
          </p>
        </div>
      </main>
    </div>
  );
}
