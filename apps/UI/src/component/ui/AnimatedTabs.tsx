import type { ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "../../lib/utils";

export type AnimatedTabItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
};

type AnimatedTabsProps = {
  activeId: string;
  items: AnimatedTabItem[];
  onChange: (id: string) => void;
  className?: string;
};

export function AnimatedTabs({ activeId, items, onChange, className }: AnimatedTabsProps) {
  return (
    <div className={cn("tabs animated-tabs", className)}>
      {items.map((item) => {
        const isActive = item.id === activeId;

        return (
          <button
            className={isActive ? "active" : ""}
            disabled={item.disabled}
            key={item.id}
            onClick={() => onChange(item.id)}
            type="button"
          >
            {isActive && (
              <motion.span
                className="animated-tabs__indicator"
                layoutId="trailwise-active-tab"
                transition={{ duration: 0.22, ease: "easeOut" }}
              />
            )}
            {item.icon}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
