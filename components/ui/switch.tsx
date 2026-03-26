import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function Switch({ checked, onChange, disabled, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]" : "bg-slate-200 dark:bg-slate-800 shadow-inner",
        className
      )}
    >
      <motion.span
        initial={false}
        animate={{
          x: checked ? 22 : 4,
          scale: 1,
        }}
        whileTap={{ scale: 0.9, width: 24 }}
        transition={{
          type: "spring",
          stiffness: 500,
          damping: 30,
        }}
        className={cn(
          "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0",
          checked ? "shadow-primary/20" : "shadow-slate-400/20"
        )}
      />
    </button>
  );
}
