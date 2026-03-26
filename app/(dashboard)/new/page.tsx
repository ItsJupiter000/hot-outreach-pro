"use client";

import { useState, useMemo, useEffect } from "react";
import { useTemplates } from "@/hooks/use-templates";
import { useSendEmail } from "@/hooks/use-email";
import { useQuery } from "@tanstack/react-query";
import { Document } from "@shared/schema";
import { Send, Loader2, Sparkles, Building2, User, Mail, PenTool, FileText, FileUp, Star, Clock, Eye } from "lucide-react";
import { useSettings } from "@/hooks/use-settings";
import { motion, AnimatePresence } from "framer-motion";

export default function Dashboard() {
  const { data: templates = [], isLoading: isLoadingTemplates } = useTemplates();
  const { mutate: sendEmail, isPending } = useSendEmail();
  const { settings, isLoading: isLoadingSettings } = useSettings();
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form');

  const { data: documents = [], isLoading: isLoadingDocuments } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
  });

  // Only resumes for the dropdown
  const resumes = useMemo(() => documents.filter(d => d.type === "Resume"), [documents]);
  const defaultResume = useMemo(() => resumes.find(d => d.isDefault), [resumes]);
  const defaultTemplate = useMemo(() => templates.find(t => t.isDefault), [templates]);

  const [form, setForm] = useState({
    companyName: "",
    email: "",
    templateId: "",
    resumeId: "",
    customMessage: "",
  });

  const [isScheduled, setIsScheduled] = useState(false);
  
  // Calculate default next Tuesday 08:45 AM
  const defaultScheduleDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + ((2 + 7 - d.getDay()) % 7 || 7)); // Next Tuesday
    d.setHours(8, 45, 0, 0);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, []);

  const [scheduledFor, setScheduledFor] = useState(defaultScheduleDate);

  // Auto-select defaults once they load
  useEffect(() => {
    if (defaultTemplate && !form.templateId) {
      setForm(prev => ({ ...prev, templateId: defaultTemplate.id }));
    }
  }, [defaultTemplate]);

  useEffect(() => {
    if (defaultResume && !form.resumeId) {
      setForm(prev => ({ ...prev, resumeId: defaultResume.id }));
    }
  }, [defaultResume]);

  const selectedTemplate = useMemo(() =>
    templates.find(t => t.id === form.templateId),
  [templates, form.templateId]);

  const selectedResume = useMemo(() =>
    resumes.find(r => r.id === form.resumeId),
  [resumes, form.resumeId]);

  const previewContent = useMemo(() => {
    if (!selectedTemplate) return "";
    let content = selectedTemplate.content;
    content = content.replace(/\{\{companyName\}\}/g, form.companyName || "[Company Name]");
    content = content.replace(/\{\{customMessage\}\}/g, form.customMessage || "[Your custom message will appear here if provided]");
    content = content.replace(/\{\{myName\}\}/g, "[Your Name]");
    content = content.replace(/\{\{myRole\}\}/g, "[Your Role]");
    return content;
  }, [selectedTemplate, form.companyName, form.customMessage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName || !form.email || !form.templateId) return;

    sendEmail(
      { 
        ...form, 
        resumeId: form.resumeId || undefined,
        scheduledFor: isScheduled ? new Date(scheduledFor).toISOString() : undefined 
      },
      {
        onSuccess: () => {
          setForm(prev => ({
            ...prev,
            companyName: "",
            email: "",
            customMessage: "",
          }));
          setActiveTab('form'); // Switch back to form after success
        },
      }
    );
  };

  const inputClass = "w-full px-4 py-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-medium";
  const labelClass = "text-[11px] font-black uppercase tracking-widest flex items-center gap-2 text-slate-500 dark:text-slate-400";

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-black text-foreground tracking-tight">Deploy Outreach</h1>
          <p className="text-muted-foreground mt-1 font-medium italic">Targeted recruitment sequence initiation.</p>
        </div>

        {/* Mobile Tab Switcher */}
        <div className="lg:hidden flex p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
           <button 
            onClick={() => setActiveTab('form')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'form' ? 'bg-white dark:bg-slate-800 text-primary shadow-sm' : 'text-slate-400'}`}
           >
             <PenTool className="w-4 h-4" /> Form
           </button>
           <button 
            onClick={() => setActiveTab('preview')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'preview' ? 'bg-white dark:bg-slate-800 text-primary shadow-sm' : 'text-slate-400'}`}
           >
             <Eye className="w-4 h-4" /> Preview
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-10">
        {/* Form Column */}
        <div className={`lg:col-span-5 space-y-6 ${activeTab === 'form' ? 'block' : 'hidden lg:block'}`}>
          <motion.form 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            onSubmit={handleSubmit} 
            className="bg-card rounded-[2.5rem] p-6 md:p-8 shadow-2xl border border-border relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16" />

            <div className="space-y-6 relative z-10">
              {/* Company */}
              <div className="space-y-2">
                <label className={labelClass}>
                  <Building2 className="w-4 h-4 text-primary" /> Target Entity
                </label>
                <input
                  type="text"
                  required
                  value={form.companyName}
                  onChange={e => setForm(prev => ({ ...prev, companyName: e.target.value }))}
                  placeholder="e.g. Acme Corp"
                  className={inputClass}
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <label className={labelClass}>
                  <User className="w-4 h-4 text-primary" /> Recipient Channel
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="recruiter@acme.com"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Template Dropdown */}
                <div className="space-y-2">
                  <label className={labelClass}>
                    <FileText className="w-4 h-4 text-primary" /> Blueprint
                  </label>
                  <div className="relative">
                    <select
                      required
                      value={form.templateId}
                      onChange={e => setForm(prev => ({ ...prev, templateId: e.target.value }))}
                      className={`${inputClass} appearance-none cursor-pointer pr-10`}
                      disabled={isLoadingTemplates}
                    >
                      <option value="" disabled>
                        {isLoadingTemplates ? "Scanning..." : "Select..."}
                      </option>
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name}{t.isDefault ? " â˜…" : ""}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                  </div>
                </div>

                {/* Resume Dropdown */}
                <div className="space-y-2">
                  <label className={labelClass}>
                    <FileUp className="w-4 h-4 text-primary" /> Payload
                  </label>
                  <div className="relative">
                    <select
                      value={form.resumeId}
                      onChange={e => setForm(prev => ({ ...prev, resumeId: e.target.value }))}
                      className={`${inputClass} appearance-none cursor-pointer pr-10`}
                      disabled={isLoadingDocuments}
                    >
                      <option value="">
                        {isLoadingDocuments ? "Syncing..." : resumes.length === 0 ? "None Found" : "No Payload"}
                      </option>
                      {resumes.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.name}{r.isDefault ? " â˜…" : ""}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Custom Message */}
              <div className="space-y-2">
                <label className={labelClass}>
                  <PenTool className="w-4 h-4 text-primary" /> Tactical Injection <span className="text-slate-400 font-bold">(OPT)</span>
                </label>
                <textarea
                  value={form.customMessage}
                  onChange={e => setForm(prev => ({ ...prev, customMessage: e.target.value }))}
                  placeholder="Inject personalized context here..."
                  rows={3}
                  className={`${inputClass} resize-none`}
                />
              </div>

              {/* Schedule Email */}
              {settings?.schedulingEnabled && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl transition-colors ${isScheduled ? 'bg-primary/20 text-primary' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-foreground">Delayed Dispatch</p>
                        <p className="text-[10px] font-bold text-muted-foreground">Execute at optimal timeframe.</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={isScheduled}
                        onChange={() => setIsScheduled(!isScheduled)}
                      />
                      <div className="w-12 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary shadow-inner"></div>
                    </label>
                  </div>

                  <AnimatePresence>
                    {isScheduled && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="pl-6 border-l-2 border-primary/20 space-y-3 py-2">
                          <input
                            type="datetime-local"
                            value={scheduledFor}
                            onChange={(e) => setScheduledFor(e.target.value)}
                            className={inputClass}
                          />
                          <p className="text-[10px] font-bold text-slate-400 italic">Optimized for Tuesday 08:45 AM deployment.</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Submit */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isPending || !form.templateId}
                  className="w-full h-14 flex items-center justify-center gap-3 rounded-2xl font-black text-xs uppercase tracking-[0.2em] bg-primary text-white shadow-xl shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 group"
                >
                  {isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Send className={`w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform`} />
                      {isScheduled ? "Confirm Schedule" : "Initiate Deployment"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.form>
        </div>

        {/* Live Preview Column */}
        <div className={`lg:col-span-7 ${activeTab === 'preview' ? 'block' : 'hidden lg:block'}`}>
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="sticky top-8 bg-card rounded-[2.5rem] border border-border shadow-2xl overflow-hidden flex flex-col h-[650px]"
          >
            {/* Window Header */}
            <div className="bg-slate-50 dark:bg-slate-900 border-b border-border px-6 py-4 flex items-center justify-between">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400/80 shadow-sm" />
                <div className="w-3 h-3 rounded-full bg-amber-400/80 shadow-sm" />
                <div className="w-3 h-3 rounded-full bg-emerald-400/80 shadow-sm" />
              </div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-primary" /> Transmission Preview
              </div>
              <div className="w-12 h-1 bg-slate-200 dark:bg-slate-800 rounded-full" />
            </div>

            {/* Email Headers */}
            <div className="px-8 py-6 border-b border-border bg-card">
              <div className="flex items-center gap-4 text-xs mb-4">
                <span className="text-slate-400 font-black uppercase tracking-widest w-16">Target:</span>
                <span className="text-foreground font-black truncate">{form.email || "recruiter@company.com"}</span>
              </div>
              <div className="flex items-start gap-4 text-xs mb-4">
                <span className="text-slate-400 font-black uppercase tracking-widest w-16 pt-0.5">Subject:</span>
                <span className="text-foreground font-black leading-relaxed">
                  {selectedTemplate
                    ? selectedTemplate.subject.replace(/\{\{companyName\}\}/g, form.companyName || "[Entity Name]")
                    : "Mission Blueprint Required"}
                </span>
              </div>
              {selectedResume && (
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-slate-400 font-black uppercase tracking-widest w-16">Data:</span>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-xl">
                    <FileUp className="w-3 h-3 text-primary" /> 
                    <span className="text-primary font-black uppercase tracking-tighter text-[10px]">{selectedResume.name}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Email Body */}
            <div className="flex-1 p-8 bg-card overflow-y-auto prose prose-slate dark:prose-invert prose-sm max-w-none custom-scrollbar">
              {isLoadingTemplates ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4">
                  <Loader2 className="w-8 h-8 animate-spin opacity-20" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Decrypting templates...</p>
                </div>
              ) : selectedTemplate ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="whitespace-pre-wrap text-foreground leading-relaxed font-sans text-sm md:text-base selection:bg-primary/20"
                  dangerouslySetInnerHTML={{ __html: previewContent }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-300 dark:text-slate-700 space-y-4">
                  <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-full">
                    <Mail className="w-12 h-12" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-black uppercase tracking-[0.2em]">Idle Mode</p>
                    <p className="text-[10px] font-bold mt-1 opacity-60">Select a blueprint to view mission details.</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
}
