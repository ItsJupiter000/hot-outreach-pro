"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { X, Moon, Sun, Settings, Mail, User, LogOut } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "@/components/theme-provider";
import { motion, AnimatePresence } from "framer-motion";
import { useHeartbeat } from "@/hooks/use-heartbeat";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  // Start client-side heartbeat for follow-ups, scheduling, inbox polling
  useHeartbeat();

  const handleSignOut = async () => {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden selection:bg-primary/30 selection:text-primary-foreground font-sans">
      <Sidebar />

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          >
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute right-0 top-0 w-[280px] h-full bg-white dark:bg-slate-950 p-6 flex flex-col shadow-2xl border-l border-slate-200 dark:border-slate-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100 dark:border-slate-900">
                <div className="flex items-center gap-2">
                  <div className="bg-primary/20 p-1.5 rounded-lg text-primary">
                    <Mail className="w-5 h-5" />
                  </div>
                  <h1 className="font-display font-black text-lg tracking-tighter">
                    Connect<span className="text-primary">Hub</span>
                  </h1>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-900 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 px-2">
                Quick Actions
              </div>

              <div className="space-y-3">
                <Link
                  href="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-black text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all border border-slate-100 dark:border-slate-800 shadow-sm"
                >
                  <User className="w-5 h-5 text-blue-500" />
                  Profile
                </Link>

                <button
                  onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                  className="flex items-center justify-between w-full px-4 py-3.5 rounded-2xl text-sm font-black text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all border border-slate-100 dark:border-slate-800 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    {theme === "light" ? (
                      <Moon className="w-5 h-5 text-indigo-500" />
                    ) : (
                      <Sun className="w-5 h-5 text-amber-500" />
                    )}
                    <span>{theme === "light" ? "Dark Mode" : "Light Mode"}</span>
                  </div>
                </button>

                <Link
                  href="/settings"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-black text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all border border-slate-100 dark:border-slate-800 shadow-sm"
                >
                  <Settings className="w-5 h-5 text-emerald-500" />
                  Global Settings
                </Link>

                <button
                  onClick={() => { setMobileMenuOpen(false); handleSignOut(); }}
                  className="flex items-center gap-3 w-full px-4 py-3.5 rounded-2xl text-sm font-black text-red-500 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 transition-all border border-red-100 dark:border-red-500/20 shadow-sm"
                >
                  <LogOut className="w-5 h-5" />
                  Sign Out
                </button>
              </div>

              <div className="mt-auto p-4 bg-primary/5 rounded-3xl border border-primary/10">
                <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1 text-center">
                  Premium Access
                </p>
                <p className="text-[9px] font-bold text-slate-400 text-center leading-relaxed">
                  System healthy and operational with 99.9% uptime.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative bg-slate-50/20 dark:bg-slate-950 pb-[72px] md:pb-0">
        <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none -z-10 dark:from-primary/10" />

        <header className="md:hidden flex items-center justify-between px-6 py-4 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/60 z-40 sticky top-0 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="bg-primary/20 p-1.5 rounded-lg text-primary">
              <Mail className="w-5 h-5" />
            </div>
            <h1 className="font-display font-black text-lg tracking-tighter">
              Connect<span className="text-primary">Hub</span>
            </h1>
          </div>
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-600 dark:text-slate-300 shadow-sm border border-slate-100 dark:border-slate-800"
          >
            <Settings className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto z-0 custom-scrollbar">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="p-4 md:p-8 lg:p-10 max-w-6xl mx-auto"
          >
            {children}
          </motion.div>
        </div>

        <MobileNav />
      </main>
    </div>
  );
}
