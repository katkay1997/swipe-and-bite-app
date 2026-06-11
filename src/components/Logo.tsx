import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";

export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const text = size === "lg" ? "text-3xl" : size === "sm" ? "text-xl" : "text-2xl";
  const icon = size === "lg" ? 28 : size === "sm" ? 20 : 24;
  return (
    <Link to="/" className="inline-flex items-center gap-2">
      <Heart
        size={icon}
        className="animate-heartbeat"
        style={{ color: "hsl(350 90% 48%)" }}
        fill="currentColor"
      />
      <span className={`font-display font-black tracking-tight text-foreground ${text}`}>
        Swipe <span className="amp">&amp;</span> Bite
      </span>
    </Link>
  );
}
