import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

type GlowCardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  active?: boolean;
};

export function GlowCard({ children, active, className, ...props }: GlowCardProps) {
  return (
    <div className={cn(active ? "glow-card glow-card-active" : "glow-card", className)} {...props}>
      {active && <span className="glow-card__aura" aria-hidden="true" />}
      {children}
    </div>
  );
}
