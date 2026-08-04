import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function GlassCard({
  children,
  className,
  glow = false,
  as: As = "div",
}: {
  children: ReactNode;
  className?: string;
  glow?: boolean;
  as?: "div" | "section" | "article" | "li";
}) {
  return (
    <As
      className={cn(
        "glass rounded-2xl p-5 transition-shadow",
        glow && "shadow-neon",
        className,
      )}
    >
      {children}
    </As>
  );
}
