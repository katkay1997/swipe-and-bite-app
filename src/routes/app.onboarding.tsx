import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/onboarding")({
  beforeLoad: () => {
    throw redirect({ to: "/app/mode" });
  },
  component: () => null,
});
