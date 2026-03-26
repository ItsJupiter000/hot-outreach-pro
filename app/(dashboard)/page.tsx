"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useApplications } from "@/hooks/use-applications";
import { Application } from "@shared/schema";
import { format, isToday } from "date-fns";
import {
  Send,
  Eye,
  MessageSquare,
  Clock,
  Activity,
  ExternalLink,
  LayoutDashboard,
  FileText,
  Files,
  BarChart2,
  ListTodo,
  Calendar,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  TrendingUp
} from "lucide-react";
import { FollowUpWidget } from "@/components/FollowUpWidget";
import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useTemplates } from "@/hooks/use-templates";

import { motion } from "framer-motion";

export default function Home() {
  const router = useRouter();
  const { data: applications = [] } = useApplications({});
  const { data: templates = [] } = useTemplates();
  const { data: documents = [] } = useQuery<any[]>({ queryKey: ["/api/documents"] });
  const { data: scheduled = [] } = useQuery<any[]>({ queryKey: ["/api/scheduled"] });

  // --- Stats and Analysis ---
  const stats = useMemo(() => {
    const sentToday: Application[] = [];
    const openedToday: Application[] = [];
    const repliedToday: Application[] = [];
    const followupToday: Application[] = [];
    const uniqueTodayIds = new Set<string>();
    const todayActivityList: { id: string; app: any; action: string; time: Date; icon: any; color: string; status: 'completed' | 'upcoming' }[] = [];

    // COMPLETED ACTIVITY
    applications.forEach(app => {
      let activityAdded = false;

      if (isToday(new Date(app.sentAt))) {
        sentToday.push(app);
        todayActivityList.push({ id: `sent-${app.id}`, app, action: "Sent outreach", time: new Date(app.sentAt), icon: Send, color: "text-indigo-500", status: 'completed' });
        uniqueTodayIds.add(app.id);
        activityAdded = true;
      }

      if (app.followUpSentAt && isToday(new Date(app.followUpSentAt))) {
        followupToday.push(app);
        todayActivityList.push({ id: `fu-${app.id}`, app, action: "Sent follow-up", time: new Date(app.followUpSentAt), icon: Clock, color: "text-orange-500", status: 'completed' });
        uniqueTodayIds.add(app.id);
      }

      if (app.history) {
        app.history.forEach((h, idx) => {
          if (isToday(new Date(h.date))) {
            if (h.status === "Opened") {
              openedToday.push(app);
              todayActivityList.push({ id: `open-${app.id}-${idx}`, app, action: "Email opened", time: new Date(h.date), icon: Eye, color: "text-cyan-500", status: 'completed' });
              uniqueTodayIds.add(app.id);
            }
            if (h.status === "Replied") {
              repliedToday.push(app);
              todayActivityList.push({ id: `reply-${app.id}-${idx}`, app, action: "Received reply", time: new Date(h.date), icon: MessageSquare, color: "text-purple-500", status: 'completed' });
              uniqueTodayIds.add(app.id);
            }
          }
        });
      }

      if (!activityAdded && isToday(new Date(app.updatedAt)) && !uniqueTodayIds.has(app.id)) {
        todayActivityList.push({ id: `update-${app.id}`, app, action: `Status: ${app.status}`, time: new Date(app.updatedAt), icon: Activity, color: "text-emerald-500", status: 'completed' });
        uniqueTodayIds.add(app.id);
      }
    });

    // UPCOMING ACTIVITY (Scheduled for Today)
    scheduled.forEach(s => {
      const scheduledTime = new Date(s.scheduledFor);
      if (isToday(scheduledTime)) {
        todayActivityList.push({ 
          id: `sched-${s.id}`, 
          app: { companyName: s.companyName, email: s.email }, 
          action: "Scheduled dispatch", 
          time: scheduledTime, 
          icon: Clock, 
          color: "text-amber-500", 
          status: 'upcoming' 
        });
      }
    });

    todayActivityList.sort((a, b) => b.time.getTime() - a.time.getTime());

    // Funnel Stats
    const totalSent = applications.length;
    const totalOpened = applications.filter(a => a.status === "Opened" || a.status === "Replied").length;
    const totalReplied = applications.filter(a => a.status === "Replied").length;
    const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;
    const replyRate = totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0;

    return { 
      sentToday, openedToday, repliedToday, followupToday, todayActivityList,
      openRate, replyRate, totalSent, totalTemplates: templates.length,
      totalDocs: documents.length, scheduledTotal: scheduled.length
    };
  }, [applications, templates, documents, scheduled]);

  // Quick Action Cards
  const navCards = [
    {
      title: "New Outreach",
      stat: "New",
      icon: Send,
      href: "/new",
      color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20",
      accent: "border-indigo-200 dark:border-indigo-900/50"
    },
    {
      title: "Applications",
      stat: stats.totalSent.toString(),
      icon: LayoutDashboard,
      href: "/applications",
      color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20",
      accent: "border-blue-200 dark:border-blue-900/50"
    },
    {
      title: "Analytics",
      stat: `${stats.openRate}% Open`,
      icon: BarChart2,
      href: "/analytics",
      color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20",
      accent: "border-emerald-200 dark:border-emerald-900/50"
    },
    {
      title: "Follow-ups",
      stat: stats.followupToday.length.toString(),
      icon: Clock,
      href: "/followup",
      color: "text-orange-600 bg-orange-50 dark:bg-orange-900/20",
      accent: "border-orange-200 dark:border-orange-900/50"
    },
    {
      title: "Scheduled",
      stat: stats.scheduledTotal.toString(),
      icon: Calendar,
      href: "/scheduled",
      color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20",
      accent: "border-amber-200 dark:border-amber-900/50"
    },
    {
      title: "Resources",
      stat: `${stats.totalTemplates + stats.totalDocs}`,
      icon: Files,
      href: "/documents",
      color: "text-cyan-600 bg-cyan-50 dark:bg-cyan-900/20",
      accent: "border-cyan-200 dark:border-cyan-900/50"
    }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: "spring", stiffness: 300, damping: 24 }
    }
  };

  return (
    <>
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-display font-black text-foreground tracking-tight">Main Dashboard</h1>
        <p className="text-muted-foreground mt-1 font-medium italic">Welcome back! Here's your dashboard summary.</p>
      </motion.div>

      {/* Compact Quick Access Section */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="mb-10"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
            <LayoutDashboard className="w-4 h-4 text-primary" /> Quick Access
          </h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {navCards.map((card) => (
            <motion.div
              key={card.title}
              variants={itemVariants}
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => router.push(card.href)}
              className={`group bg-card hover:bg-slate-50 dark:hover:bg-slate-900 border ${card.accent} rounded-3xl p-4 transition-all cursor-pointer shadow-sm hover:shadow-xl flex flex-col items-center text-center relative overflow-hidden`}
            >
              <div className={`p-3 rounded-2xl ${card.color} mb-3 group-hover:rotate-6 transition-transform`}>
                <card.icon className="w-5 h-5" />
              </div>
              <h3 className="font-black text-foreground text-[11px] mb-1.5 truncate w-full uppercase tracking-tight">{card.title}</h3>
              <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                <p className="text-[9px] font-black tracking-widest text-muted-foreground uppercase">{card.stat}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
         {/* Today's Activity Center */}
         <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-foreground flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" /> Daily Activity
              </h2>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-2xl">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-[9px] font-black text-primary uppercase tracking-widest">Real-time Feed</span>
              </div>
            </div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-card border border-border rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden group"
            >
               <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full -mr-40 -mt-40 blur-[100px] opacity-50 group-hover:opacity-80 transition-opacity" />
               
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 relative z-10">
                  {[
                    { label: "Sent", val: stats.sentToday.length, col: "indigo" },
                    { label: "Opens", val: stats.openedToday.length, col: "cyan" },
                    { label: "Replies", val: stats.repliedToday.length, col: "purple" },
                    { label: "Pending", val: stats.todayActivityList.filter(a => a.status === 'upcoming').length, col: "amber" }
                  ].map((s, idx) => (
                    <motion.div 
                      key={s.label}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3 + (idx * 0.1) }}
                      className={`p-5 bg-${s.col}-50 dark:bg-${s.col}-900/10 rounded-3xl border border-${s.col}-100 dark:border-${s.col}-900/20`}
                    >
                      <p className={`text-3xl font-black text-${s.col}-600 tracking-tighter`}>{s.val}</p>
                      <p className={`text-[10px] font-black text-${s.col}-500/70 uppercase tracking-widest mt-1`}>{s.label}</p>
                    </motion.div>
                  ))}
               </div>

               <div className="space-y-4 relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[10px] font-black text-slate-400 flex items-center gap-2 uppercase tracking-[0.2em]">
                      Activity History <ArrowRight className="w-3 h-3" />
                    </h3>
                  </div>

                  {stats.todayActivityList.length === 0 ? (
                    <div className="py-16 text-center bg-slate-50/50 dark:bg-slate-900/30 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
                       <Sparkles className="w-10 h-10 text-slate-300 mx-auto mb-4" />
                       <p className="text-sm font-black text-slate-400 italic">No activity yet. Start your first outreach.</p>
                       <button onClick={() => router.push("/new")} className="mt-6 px-6 py-3 bg-white dark:bg-slate-900 shadow-xl rounded-2xl text-[10px] font-black text-primary hover:scale-110 active:scale-95 transition-all uppercase tracking-widest border border-slate-100 dark:border-slate-800">New Outreach â†’</button>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar lg:pr-4">
                      {stats.todayActivityList.map((act, idx) => (
                        <motion.div 
                          key={act.id} 
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.4 + (idx * 0.05) }}
                          className={`flex items-center gap-4 p-4 rounded-3xl border transition-all hover:bg-slate-50 dark:hover:bg-slate-900/50 ${act.status === 'upcoming' ? 'bg-amber-50/30 dark:bg-amber-900/5 border-amber-100/50 dark:border-amber-900/20' : 'bg-background border-border shadow-sm'}`}
                        >
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${act.status === 'upcoming' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 dark:bg-slate-800'}`}>
                            <act.icon className={`w-6 h-6 ${act.status === 'upcoming' ? 'text-amber-600' : act.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-sm font-black text-foreground truncate">{act.app.companyName}</p>
                              {act.status === 'upcoming' && (
                                <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-amber-500 text-white uppercase tracking-widest">Queued</span>
                              )}
                              {act.status === 'completed' && (
                                <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-emerald-500 text-white uppercase tracking-widest flex items-center gap-1">
                                  <CheckCircle2 className="w-2.5 h-2.5" /> Executed
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-tight">{act.action}</p>
                          </div>
                          <div className="text-right shrink-0">
                             <p className="text-[11px] font-black text-foreground/80">{format(act.time, "h:mm a")}</p>
                             <a 
                               href={`https://mail.google.com/mail/u/0/#search/to:${act.app.email}`}
                               target="_blank"
                               rel="noopener noreferrer"
                               className="text-[10px] font-black text-primary hover:underline mt-1.5 inline-flex items-center gap-1 uppercase tracking-tighter"
                             >
                               Gmail <ExternalLink className="w-2.5 h-2.5" />
                             </a>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
               </div>
            </motion.div>
         </div>

         {/* Stats Sidebar */}
         <div className="space-y-6">
            <h2 className="text-xl font-black text-foreground flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" /> Performance
            </h2>
            
            <div className="space-y-4">
               <motion.div 
                 initial={{ opacity: 0, x: 20 }}
                 animate={{ opacity: 1, x: 0 }}
                 transition={{ delay: 0.5 }}
                 className="bg-card border border-border rounded-[2.5rem] p-8 shadow-xl relative overflow-hidden"
               >
                  <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl" />
                  <div className="flex items-center justify-between mb-8">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Performance Stats</p>
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded-xl">
                      <BarChart2 className="w-5 h-5 text-emerald-500" />
                    </div>
                  </div>
                  
                  <div className="space-y-8">
                    <div className="space-y-3">
                      <div className="flex justify-between text-[11px] font-black uppercase tracking-widest">
                        <span className="text-slate-400">Open Rate</span>
                        <span className="text-cyan-500">{stats.openRate}%</span>
                      </div>
                      <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${stats.openRate}%` }}
                          transition={{ duration: 1.5, ease: "circOut" }}
                          className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full shadow-[0_0_12px_rgba(6,182,212,0.4)]" 
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between text-[11px] font-black uppercase tracking-widest">
                        <span className="text-slate-400">Reply Rate</span>
                        <span className="text-purple-500">{stats.replyRate}%</span>
                      </div>
                      <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${stats.replyRate}%` }}
                          transition={{ duration: 1.5, ease: "circOut", delay: 0.2 }}
                          className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full shadow-[0_0_12px_rgba(168,85,247,0.4)]" 
                        />
                      </div>
                    </div>
                  </div>
               </motion.div>

               <motion.div 
                 initial={{ opacity: 0, scale: 0.95 }}
                 animate={{ opacity: 1, scale: 1 }}
                 transition={{ delay: 0.7 }}
                 className="bg-primary text-primary-foreground rounded-[2.5rem] p-8 shadow-2xl shadow-primary/30 flex flex-col items-center text-center relative overflow-hidden group"
               >
                 <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full -ml-16 -mt-16 blur-[60px] group-hover:scale-150 transition-transform duration-1000" />
                 <div className="bg-white/20 p-4 rounded-3xl mb-6 backdrop-blur-md">
                   <Sparkles className="w-8 h-8 text-white" />
                 </div>
                 <h3 className="font-black text-xl leading-tight mb-3">Expand Your Network</h3>
                 <p className="text-[11px] font-bold opacity-70 mb-8 px-4 leading-relaxed uppercase tracking-wider">The next big opportunity is just one personalized email away.</p>
                 <button 
                  onClick={() => router.push("/new")}
                  className="w-full py-4.5 bg-white text-primary rounded-[1.25rem] font-black text-xs hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-black/20 uppercase tracking-[0.2em]"
                 >
                   New Outreach
                 </button>
               </motion.div>
            </div>
         </div>
      </div>

      <FollowUpWidget />
    </>
  );
}

