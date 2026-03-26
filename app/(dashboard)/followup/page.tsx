"use client";

import { useState, useEffect } from "react";
import { useTemplates } from "@/hooks/use-templates";
import { useApplications } from "@/hooks/use-applications";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Application, Settings } from "@shared/schema";
import {
  Clock,
  FileText,
  Save,
  Loader2,
  Zap,
  CheckCircle2,
  RefreshCw,
  Calendar,
  AlertCircle,
  ArrowRight,
  Settings2,
  Mail,
  Send,
  Sparkles,
  ListTodo,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  User,
  Hash
} from "lucide-react";
import { format, addDays } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { useSettings } from "@/hooks/use-settings";
import { Switch } from "@/components/ui/switch";

export default function FollowUp() {
  const { data: templates = [], isLoading: isLoadingTemplates } = useTemplates();
  const { data: applications = [], isLoading: isLoadingApps } = useApplications({});
  const { settings, updateSettings, isUpdating } = useSettings();
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: dueApps = [] } = useQuery<Application[]>({
    queryKey: ["/api/applications/follow-ups-due"],
  });

  const updateAll = useMutation({
    mutationFn: async ({ templateId, days }: { templateId: string | null; days: number | null }) => {
      const activeApps = applications.filter(
        (a: Application) => a.status === "Applied" || a.status === "Opened" || a.status === "Follow-up Sent"
      );
      await Promise.all(
        activeApps.map((app: Application) =>
          apiRequest("PATCH", `/api/applications/${app.id}/followup`, { templateId, days })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      toast({
        title: "Settings Applied",
        description: "Follow-up configuration has been updated for all active applications.",
      });
    },
  });

  const sendFollowUpMutation = useMutation({
    mutationFn: async (appId: string) => {
      await apiRequest("POST", `/api/applications/${appId}/followup/send`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications/follow-ups-due"] });
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      toast({ title: "Follow-up Sent" });
    },
  });

  const activeApps = applications.filter(
    (a: Application) => a.status === "Applied" || a.status === "Opened"
  );
  const scheduledApps = applications.filter(
    (a: Application) => !!(a as any).followUpTemplateId && !(a as any).followUpSentAt
  );
  const sentApps = applications.filter((a: Application) => a.status === "Follow-up Sent");

  const selectedTemplate = templates.find(t => t.id === (settings as any)?.followUpTemplateId);

  const stats = [
    { label: "Active Applications", value: activeApps.length, icon: Mail, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20" },
    { label: "Scheduled Follow-ups", value: scheduledApps.length, icon: Calendar, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/20" },
    { label: "Follow-ups Sent", value: sentApps.length, icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
  ];

  return (
    <>
      <div className="relative mb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">Auto Follow-up</div>
              <Sparkles className="w-4 h-4 text-amber-400" />
            </div>
            <h1 className="text-4xl font-display font-black text-foreground tracking-tight">Follow-up Automation</h1>
            <p className="text-muted-foreground mt-2 max-w-xl text-lg">
              Smart automation to keep your application threads alive. Configure once, automate many.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
             <div className={`flex items-center gap-4 px-5 py-3 rounded-[1.5rem] border transition-all ${settings?.followUpsEnabled ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800 shadow-sm' : 'bg-slate-50 border-slate-200 dark:bg-slate-900/20 dark:border-slate-800'}`}>
                <div className="flex flex-col">
                  <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${settings?.followUpsEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                    System Status
                  </span>
                  <span className={`text-sm font-bold ${settings?.followUpsEnabled ? 'text-emerald-900 dark:text-emerald-200' : 'text-slate-500'}`}>
                    {settings?.followUpsEnabled ? 'Active' : 'Paused'}
                  </span>
                </div>
                <div className="w-px h-8 bg-border/50 mx-1" />
                <Switch 
                  checked={settings?.followUpsEnabled ?? true}
                  onChange={(checked) => updateSettings({ followUpsEnabled: checked })}
                />
             </div>
          </div>
        </div>
      </div>

      {/* Modern Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-card border border-border rounded-3xl p-6 shadow-sm hover:shadow-md transition-all group"
          >
            <div className={`${s.bg} w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
              <s.icon className={`w-6 h-6 ${s.color}`} />
            </div>
            <p className="text-4xl font-black text-foreground mb-1 tracking-tight">{s.value}</p>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{s.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Configuration */}
        <div className="lg:col-span-5 space-y-8">
          <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-xl shadow-slate-200/50 dark:shadow-none">
            <div className="bg-slate-50/50 dark:bg-slate-900/50 px-8 py-6 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Settings2 className="w-5 h-5 text-primary" />
                <h2 className="font-bold text-lg">Automation Settings</h2>
              </div>
              {isUpdating && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
            </div>
            
            <div className="p-8 space-y-8">
              <div className="space-y-3">
                <label className="text-sm font-bold text-foreground/80 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" /> Default Sequence Template
                </label>
                <select
                  value={(settings as any)?.followUpTemplateId || ""}
                  onChange={e => updateSettings({ followUpTemplateId: e.target.value })}
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-border text-foreground font-medium focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all appearance-none cursor-pointer"
                >
                  <option value="">Choose a template...</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-foreground/80 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" /> Silence Threshold
                  </label>
                  <span className="text-primary font-black text-xl">
                    {(settings as any)?.followUpDays || 4} <span className="text-xs uppercase">Days</span>
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={14}
                  value={(settings as any)?.followUpDays || 4}
                  onChange={e => updateSettings({ followUpDays: Number(e.target.value) })}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">
                  The system will automatically bump the thread if no response is detected within this window.
                </p>
              </div>

              <button
                onClick={() => updateAll.mutate({ 
                  templateId: (settings as any)?.followUpTemplateId, 
                  days: (settings as any)?.followUpDays 
                })}
                disabled={updateAll.isPending || !(settings as any)?.followUpTemplateId}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-primary text-primary-foreground font-black text-lg shadow-lg shadow-primary/20 hover:shadow-xl hover:-translate-y-1 transition-all disabled:opacity-50 disabled:translate-y-0"
              >
                {updateAll.isPending ? <Loader2 className="w-6 h-6 animate-spin" /> : <Zap className="w-6 h-6" />}
                Apply to All
              </button>
            </div>
          </div>

          {/* Quick Tip */}
          <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-3xl p-6 flex gap-4">
            <AlertCircle className="w-6 h-6 text-indigo-500 shrink-0" />
            <div>
              <p className="font-bold text-indigo-900 dark:text-indigo-300 text-sm">Pro Tip: Personalization counts</p>
              <p className="text-indigo-700/70 dark:text-indigo-400/70 text-xs mt-1 leading-relaxed">
                Automated follow-ups work best when they feel human. Use variables like <code className="bg-indigo-200/50 px-1 rounded">{"{{companyName}}"}</code> to keep them contextual.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Execution Queue */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-black text-xl text-foreground flex items-center gap-2">
              <ListTodo className="w-6 h-6 text-primary" /> The Queue
            </h3>
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{dueApps.length + scheduledApps.length} Total</span>
          </div>

          <div className="space-y-4 pb-20 lg:pb-0">
            <AnimatePresence mode="popLayout">
              {dueApps.length === 0 && scheduledApps.length === 0 && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }} 
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-card border-2 border-dashed border-border rounded-[2.5rem] p-12 text-center"
                >
                  <Mail className="w-12 h-12 text-muted mx-auto mb-4 opacity-20" />
                   <p className="font-black text-foreground uppercase tracking-widest text-sm">All caught up</p>
                   <p className="text-xs text-muted-foreground mt-1 font-medium italic">No pending action items detected.</p>
                </motion.div>
              )}

              {/* Due Now Items */}
              {dueApps.map((app, idx) => {
                const appTemplate = templates.find(t => t.id === app.followUpTemplateId) || selectedTemplate;

                return (
                  <motion.div
                    key={app.id}
                    layout
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-primary/[0.03] dark:bg-primary/[0.02] border border-primary/10 rounded-[2rem] overflow-hidden group hover:border-primary/30 transition-all p-5 shadow-sm relative"
                  >
                    <div className="absolute top-0 right-0 p-3">
                       <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500 text-white text-[9px] font-black uppercase tracking-widest shadow-lg shadow-red-500/20">
                         <Zap className="w-2.5 h-2.5 fill-current" /> Due
                       </span>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="flex items-start md:items-center gap-4 flex-1 min-w-0">
                        <div className="w-14 h-14 rounded-2xl bg-primary text-white flex items-center justify-center font-black text-xl shadow-xl shadow-primary/20 shrink-0">
                          {app.companyName.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-black text-slate-900 dark:text-white text-lg uppercase tracking-tight truncate mb-1">{app.companyName}</h4>
                          <div className="flex flex-col gap-1">
                             <a
                                href={`https://mail.google.com/mail/u/0/#search/to:${app.email}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] font-black text-primary hover:underline flex items-center gap-1.5 uppercase tracking-widest opacity-80"
                              >
                                {app.email}
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:border-l border-primary/10 md:pl-6">
                        <div className="bg-white dark:bg-slate-900/50 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                          <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1 leading-none">Due Since</p>
                          <div className="flex items-center gap-1.5 text-[10px] font-black text-red-600">
                            <Clock className="w-3 h-3" />
                            {format(addDays(new Date(app.sentAt), app.followUpDays || settings?.followUpDays || 4), "MMM d")}
                          </div>
                        </div>
                        <div className="bg-white dark:bg-slate-900/50 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 hidden md:block text-slate-400">
                          <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1 leading-none">Sequence</p>
                           <p className="text-[10px] font-black truncate">{appTemplate?.name || "Default"}</p>
                        </div>
                        <div className="bg-white dark:bg-slate-900/50 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                          <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1 leading-none">Rule</p>
                          <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-600 dark:text-slate-400">
                            <Hash className="w-3 h-3 text-primary" />
                            {app.followUpDays || settings?.followUpDays || 4} Days
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => sendFollowUpMutation.mutate(app.id)}
                        disabled={sendFollowUpMutation.isPending}
                        className="w-full md:w-auto bg-primary text-white h-12 md:h-14 px-8 rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 font-black text-xs uppercase tracking-widest"
                      >
                         {sendFollowUpMutation.isPending && sendFollowUpMutation.variables === app.id ? (
                           <Loader2 className="w-5 h-5 animate-spin" />
                         ) : (
                           <>
                             Send now
                             <Send className="w-4 h-4" />
                           </>
                         )}
                      </button>
                    </div>
                  </motion.div>
                );
              })}

              {/* Scheduled Items */}
              {scheduledApps.map((app, idx) => {
                const appTemplate = templates.find(t => t.id === app.followUpTemplateId) || selectedTemplate;

                return (
                  <motion.div
                    key={app.id}
                    layout
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: (dueApps.length + idx) * 0.05 }}
                    className="bg-card border border-border rounded-[2rem] p-5 shadow-sm group hover:border-primary/20 transition-all opacity-80"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-900 text-slate-400 flex items-center justify-center font-black text-xl shrink-0 border border-slate-100 dark:border-slate-800">
                          {app.companyName.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-black text-slate-700 dark:text-slate-300 text-lg uppercase tracking-tight truncate mb-1">{app.companyName}</h4>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 text-[9px] font-black uppercase tracking-widest border border-amber-100 dark:border-amber-900/50 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" /> Scheduled
                            </span>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                               Next Drop: {format(addDays(new Date(app.sentAt), (app as any).followUpDays || 4), "MMM d")}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 md:border-l border-slate-100 dark:border-slate-800 md:pl-6 shrink-0">
                        <div className="hidden md:block">
                          <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Queue</p>
                          <p className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-tight">{appTemplate?.name || "Default"}</p>
                        </div>
                        <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-primary transition-all group-hover:translate-x-1" />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </>
  );
}

