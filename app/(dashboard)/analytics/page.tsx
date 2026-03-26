"use client";

import { useMemo, useState } from "react";
import { useApplications } from "@/hooks/use-applications";
import { Application } from "@shared/schema";
import { format, subDays, startOfDay, isAfter } from "date-fns";
import { ExternalLink, TrendingUp, Mail, Eye, MessageSquare, Briefcase, Trophy, AlertCircle, Clock, Send, ArrowRight, MousePointer2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, Legend,
} from "recharts";

const STATUS_COLOR: Record<string, string> = {
  Applied: "#6366f1",
  Opened: "#06b6d4",
  "Follow-up Sent": "#f97316",
  Replied: "#a855f7",
  Interview: "#f59e0b",
  Offer: "#10b981",
  Rejected: "#ef4444",
  "No Response": "#94a3b8",
};

const RANGE_OPTIONS = [
  { label: "7D", days: 7, full: "7 Days" },
  { label: "14D", days: 14, full: "14 Days" },
  { label: "30D", days: 30, full: "30 Days" },
  { label: "All", days: 0, full: "All Time" },
];

function Metric({ icon: Icon, label, value, sub, color, delay }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string; delay: number;
}) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-card border border-border/60 rounded-[2rem] p-5 flex flex-col items-start justify-between group hover:border-primary/20 transition-all shadow-sm"
    >
      <div className={`rounded-2xl p-3 ${color} mb-3 group-hover:scale-110 transition-transform`}><Icon className="w-5 h-5" /></div>
      <div>
        <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{value}</p>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{label}</p>
      </div>
    </motion.div>
  );
}

function pct(num: number, denom: number) {
  if (!denom) return "0%";
  return `${Math.round((num / denom) * 100)}%`;
}

export default function Analytics() {
  const { data: allApps = [], isLoading } = useApplications({});
  const [rangeDays, setRangeDays] = useState(14);

  // Filter apps by range
  const apps: Application[] = useMemo(() => {
    if (!rangeDays) return allApps;
    const cutoff = subDays(new Date(), rangeDays);
    return allApps.filter(a => isAfter(new Date(a.sentAt), cutoff));
  }, [allApps, rangeDays]);

  // â”€â”€â”€ Funnel data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const total = apps.length;
  const opened = apps.filter(a => ["Opened", "Replied", "Interview", "Offer", "Follow-up Sent"].includes(a.status)).length;
  const replied = apps.filter(a => ["Replied", "Interview", "Offer"].includes(a.status)).length;
  const interview = apps.filter(a => ["Interview", "Offer"].includes(a.status)).length;
  const offer = apps.filter(a => a.status === "Offer").length;

  const funnelSteps = [
    { label: "Outbound", value: total, pct: "100%", color: "#6366f1", bg: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400", icon: Send },
    { label: "Interested", value: opened, pct: pct(opened, total), color: "#06b6d4", bg: "bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400", icon: Eye },
    { label: "Engaged", value: replied, pct: pct(replied, total), color: "#a855f7", bg: "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400", icon: MessageSquare },
    { label: "Qualified", value: interview, pct: pct(interview, total), color: "#f59e0b", bg: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400", icon: Briefcase },
    { label: "Winner", value: offer, pct: pct(offer, total), color: "#10b981", bg: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400", icon: Trophy },
  ];

  // â”€â”€â”€ Day-wise chart â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const days = rangeDays || 30;
  const dailyData = useMemo(() => {
    return Array.from({ length: Math.min(days, 30) }, (_, i) => {
      const day = startOfDay(subDays(new Date(), Math.min(days, 30) - 1 - i));
      const dayApps = allApps.filter(a =>
        startOfDay(new Date(a.sentAt)).getTime() === day.getTime()
      );
      return {
        date: format(day, "MMM d"),
        Sent: dayApps.length,
        Opened: dayApps.filter(a => ["Opened", "Replied", "Interview", "Offer"].includes(a.status)).length,
        "Replied": dayApps.filter(a => ["Replied", "Interview", "Offer"].includes(a.status)).length,
        "Follow-up": dayApps.filter(a => a.status === "Follow-up Sent").length,
      };
    });
  }, [allApps, days]);

  // â”€â”€â”€ Status distribution pie â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const statusCounts = useMemo(() => {
    const map: Record<string, number> = {};
    apps.forEach(a => { map[a.status] = (map[a.status] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [apps]);

  // â”€â”€â”€ Activity feed â€” recent apps sorted newest first â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const recentApps = useMemo(() =>
    [...apps].sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()).slice(0, 20),
    [apps]
  );

  // â”€â”€â”€ Best day to send (by weekday reply rate) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const weekdayStats = useMemo(() => {
    const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const stats = DAYS.map(d => ({ day: d, sent: 0, replied: 0 }));
    allApps.forEach(a => {
      const wd = new Date(a.sentAt).getDay();
      stats[wd].sent++;
      if (["Replied", "Interview", "Offer"].includes(a.status)) stats[wd].replied++;
    });
    return stats.map(s => ({ ...s, rate: s.sent ? (s.replied / s.sent) * 100 : 0 }));
  }, [allApps]);

  const statusActivityMap: Record<string, { icon: React.ElementType; color: string; badge: string }> = {
    Applied:       { icon: Send, color: "text-indigo-500", badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" },
    Opened:        { icon: Eye, color: "text-cyan-500", badge: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400" },
    "Follow-up Sent": { icon: Clock, color: "text-orange-500", badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
    Replied:       { icon: MessageSquare, color: "text-purple-500", badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
    Interview:     { icon: Briefcase, color: "text-amber-500", badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    Offer:         { icon: Trophy, color: "text-emerald-500", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    Rejected:      { icon: AlertCircle, color: "text-red-500", badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    "No Response": { icon: Mail, color: "text-slate-400", badge: "bg-slate-100 text-slate-600 dark:bg-slate-900/30 dark:text-slate-400" },
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-popover border border-border rounded-2xl shadow-2xl px-5 py-4 text-sm backdrop-blur-md">
        <p className="font-black text-[10px] uppercase tracking-widest mb-3 text-muted-foreground">{label}</p>
        <div className="space-y-2">
          {payload.map((p: any) => (
            <div key={p.name} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
                <span className="font-bold text-xs text-foreground uppercase tracking-tight">{p.name}</span>
              </div>
              <span className="font-black text-xs text-foreground">{p.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between mb-10 gap-6">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-4xl font-display font-black text-foreground tracking-tight">Analytics</h1>
          <p className="text-muted-foreground mt-2 font-medium italic">Track your application performance and conversion rates.</p>
        </motion.div>
        {/* Range toggle */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900/50 rounded-2xl p-1.5 border border-slate-200 dark:border-slate-800"
        >
          {RANGE_OPTIONS.map(r => (
            <button
              key={r.label}
              onClick={() => setRangeDays(r.days)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all ${
                rangeDays === r.days
                  ? "bg-white dark:bg-slate-800 shadow-xl shadow-slate-200 dark:shadow-none text-primary"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {r.label}
            </button>
          ))}
        </motion.div>
      </div>

      {/* â”€â”€â”€ Metric Cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <Metric icon={Send} label="Total Sent" value={total} color="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400" delay={0.05} />
        <Metric icon={MousePointer2} label="Open Rate" value={pct(opened, total)} color="bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400" delay={0.1} />
        <Metric icon={MessageSquare} label="Reply Rate" value={pct(replied, total)} color="bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400" delay={0.15} />
        <Metric icon={Trophy} label="Offers" value={pct(offer, total)} color="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400" delay={0.2} />
      </div>

      {/* â”€â”€â”€ Funnel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="bg-card border border-border/60 rounded-[2.5rem] p-8 mb-10 shadow-sm relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl" />
        <h2 className="font-black text-lg text-foreground mb-10 flex items-center gap-3 uppercase tracking-tight relative z-10">
          <TrendingUp className="w-5 h-5 text-primary" /> Application Funnel
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 items-end relative z-10">
          {funnelSteps.map((step, i) => {
            const heightPct = total ? Math.max((step.value / total) * 100, step.value > 0 ? 8 : 0) : 0;
            return (
              <div key={step.label} className="flex flex-col items-center group">
                <div className="relative w-full h-40 flex items-end">
                   <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${heightPct}%` }}
                    transition={{ duration: 1.5, ease: "circOut", delay: 0.4 + (i * 0.1) }}
                    className="w-full rounded-2xl transition-all duration-300 shadow-lg group-hover:shadow-primary/20"
                    style={{
                      background: `linear-gradient(to top, ${step.color}, ${step.color}dd)`,
                      boxShadow: `0 10px 30px -10px ${step.color}55`
                    }}
                  />
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-6 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{step.value} Applications</span>
                  </div>
                </div>
                <div className="mt-6 text-center">
                  <p className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-widest mb-1 truncate w-full">{step.label}</p>
                  <span className={`inline-block text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-border shadow-sm transform group-hover:scale-110 transition-transform ${step.bg}`}>
                    {step.pct}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* â”€â”€â”€ Day-wise Area Chart â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 bg-card border border-border/60 rounded-[2.5rem] p-8 shadow-sm"
        >
           <h2 className="font-black text-lg text-foreground mb-8 uppercase tracking-tight">Activity Over Time</h2>
          <div className="h-[300px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  {[
                    { id: "Sent", color: "#6366f1" },
                    { id: "Opened", color: "#06b6d4" },
                    { id: "Replied", color: "#a855f7" },
                    { id: "Follow-up", color: "#f97316" },
                  ].map(({ id, color }) => (
                    <linearGradient key={id} id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-100 dark:stroke-slate-800" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fontWeight: 900, fill: "#94a3b8" }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  allowDecimals={false} 
                  tick={{ fontSize: 9, fontWeight: 900, fill: "#94a3b8" }} 
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Area type="monotone" dataKey="Sent" stroke="#6366f1" fill="url(#grad-Sent)" strokeWidth={3} />
                <Area type="monotone" dataKey="Opened" stroke="#06b6d4" fill="url(#grad-Opened)" strokeWidth={3} />
                <Area type="monotone" dataKey="Replied" stroke="#a855f7" fill="url(#grad-Replied)" strokeWidth={3} />
                <Area type="monotone" dataKey="Follow-up" stroke="#f97316" fill="url(#grad-Follow-up)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
           <div className="flex flex-wrap gap-4 mt-8 pt-6 border-t border-slate-50 dark:border-slate-800">
            {[["Sent","#6366f1"],["Opened","#06b6d4"],["Replied","#a855f7"],["Follow-up","#f97316"]].map(([label, color]) => (
              <span key={label} className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: color as string }} />
                {label}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Status Pie */}
         <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-card border border-border/60 rounded-[2.5rem] p-8 shadow-sm flex flex-col"
        >
          <h2 className="font-black text-lg text-foreground mb-8 uppercase tracking-tight">Status Distribution</h2>
           {statusCounts.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-[10px] font-black uppercase tracking-widest italic">Insufficient applications</div>
          ) : (
            <div className="flex-1 flex flex-col justify-between">
              <div className="h-[180px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusCounts}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="none"
                    >
                      {statusCounts.map((entry) => (
                        <Cell key={entry.name} fill={STATUS_COLOR[entry.name] || "#94a3b8"} className="hover:opacity-80 transition-opacity" />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3 mt-8">
                {statusCounts.map(s => (
                  <div key={s.name} className="flex items-center justify-between">
                    <span className="flex items-center gap-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_COLOR[s.name] || "#94a3b8" }} />
                      {s.name}
                    </span>
                    <span className="text-xs font-black text-slate-900 dark:text-white uppercase">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Activity Feed */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-card border border-border/60 rounded-[2.5rem] overflow-hidden shadow-sm mb-24"
      >
         <div className="px-8 py-6 border-b border-border/60 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <h2 className="font-black text-sm text-foreground uppercase tracking-widest">Recent Activity</h2>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight">Last 20 Applications</span>
        </div>
        <div className="divide-y divide-slate-50 dark:divide-slate-800">
          <AnimatePresence mode="popLayout">
            {recentApps.map((app, idx) => {
              const meta = statusActivityMap[app.status] ?? statusActivityMap["No Response"];
              const Icon = meta.icon;
              return (
                <motion.div 
                  key={app.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 + (idx * 0.02) }}
                  className="px-8 py-5 flex items-center gap-5 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-all group"
                >
                  <div className={`w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center ${meta.color} group-hover:scale-110 transition-transform shadow-inner`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-900 dark:text-white text-sm truncate uppercase tracking-tight">{app.companyName}</p>
                    <a
                      href={`https://mail.google.com/mail/u/0/#search/to:${app.email}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-black text-primary hover:underline flex items-center gap-1.5 uppercase tracking-widest opacity-60 group-hover:opacity-100"
                    >
                      {app.email} <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-sm border border-border/40 ${meta.badge}`}>
                      {app.status}
                    </span>
                    <span className="text-[9px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-tighter">
                      {format(new Date(app.sentAt), "MMM d, yyyy")}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  );
}
