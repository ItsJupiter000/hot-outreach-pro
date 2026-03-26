"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Send, LayoutDashboard, Clock, Calendar } from "lucide-react";
import { motion } from "framer-motion";

const mobileNavItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/new", label: "New", icon: Send },
  { href: "/applications", label: "Apps", icon: LayoutDashboard },
  { href: "/followup", label: "Follow-up", icon: Clock },
  { href: "/scheduled", label: "Scheduled", icon: Calendar },
];

export function MobileNav() {
  const location = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 px-2 pb-safe pt-2 z-50 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] dark:shadow-[0_-4px_24px_-10px_rgba(0,0,0,0.5)]">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {mobileNavItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <button className="flex flex-col items-center gap-1.5 py-1 px-3 min-w-[64px] relative group">
                <div className={`p-1.5 rounded-xl transition-all duration-300 ${isActive ? 'bg-primary text-white scale-110 shadow-lg shadow-primary/30' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-900 dark:group-hover:text-slate-200'}`}>
                  <item.icon className="w-5 h-5" />
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest transition-colors duration-300 ${isActive ? 'text-primary' : 'text-slate-400 dark:text-slate-500'}`}>
                  {item.label}
                </span>
                {isActive && (
                  <motion.div 
                    layoutId="mobileNavActive"
                    className="absolute -bottom-1 w-6 h-1 bg-primary rounded-full"
                    transition={{ type: "spring", bounce: 0.3, duration: 0.6 }}
                  />
                )}
              </button>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
