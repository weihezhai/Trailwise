import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

type MovingBorderButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export function MovingBorderButton({ children, className, disabled, ...props }: MovingBorderButtonProps) {
  return (
    <button className={cn("moving-border-button", className)} disabled={disabled} {...props}>
      {!disabled && <span className="moving-border-button__glow" aria-hidden="true" />}
      <span className="moving-border-button__content">{children}</span>
    </button>
  );
}
