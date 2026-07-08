import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

type GridBackgroundProps = {
  children?: ReactNode;
  className?: string;
};

export function GridBackground({ children, className }: GridBackgroundProps) {
  return (
    <div className={cn("aceternity-grid-background", className)}>
      <span className="aceternity-grid-layer" aria-hidden="true" />
      <span className="aceternity-dot-layer" aria-hidden="true" />
      {children}
    </div>
  );
}
