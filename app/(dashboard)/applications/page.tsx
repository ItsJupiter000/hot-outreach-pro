"use client";

import { useState } from "react";
import { useApplications, useUpdateApplication } from "@/hooks/use-applications";
import { Application, ApplicationStatus } from "@shared/schema";
import { Modal } from "@/components/ui/Modal";
import { format } from "date-fns";
import { Search, Filter, Loader2, Edit3, Save, Trash2, ExternalLink } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const statusColors: Record<ApplicationStatus, string> = {
  "Applied": "bg-blue-100 text-blue-700 border-blue-200",
  "Opened": "bg-cyan-100 text-cyan-700 border-cyan-200",
  "Replied": "bg-purple-100 text-purple-700 border-purple-200",
  "Interview": "bg-amber-100 text-amber-700 border-amber-200",
  "Rejected": "bg-red-100 text-red-700 border-red-200",
  "Offer": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "No Response": "bg-slate-100 text-slate-700 border-slate-200",
  "Follow-up Sent": "bg-orange-100 text-orange-700 border-orange-200",
};

export default function Applications() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const { toast } = useToast();
  
  const { data: applications = [], isLoading } = useApplications({ search, status: statusFilter });
  const { mutate: updateApp } = useUpdateApplication();

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/applications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      toast({ title: "Deleted", description: "Application removed from history" });
    },
  });

  const [notesModal, setNotesModal] = useState<{ isOpen: boolean; app: Application | null }>({ isOpen: false, app: null });
  const [editingNotes, setEditingNotes] = useState("");

  const handleStatusChange = (id: string, newStatus: ApplicationStatus) => {
    updateApp({ id, updates: { status: newStatus } });
  };

  const openNotes = (app: Application) => {
    setEditingNotes(app.notes || "");
    setNotesModal({ isOpen: true, app });
  };

  const saveNotes = () => {
    if (notesModal.app) {
      updateApp({ id: notesModal.app.id, updates: { notes: editingNotes } });
      setNotesModal({ isOpen: false, app: null });
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this application record?")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Applications Tracking</h1>
          <p className="text-muted-foreground mt-2">Monitor and update your job outreach history.</p>
        </div>
        
        <div className="flex gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search companies..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 w-full md:w-64 transition-all"
            />
          </div>
          
          <div className="relative">
            <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <select 
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="pl-9 pr-8 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 appearance-none transition-all"
            >
              <option value="">All Statuses</option>
              {Object.keys(statusColors).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-2xl shadow-card border border-border/50 overflow-hidden">
        {/* Mobile-friendly card view (hidden on desktop) */}
        <div className="md:hidden">
          {isLoading ? (
            <div className="p-12 text-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mx-auto opacity-20" />
            </div>
          ) : applications.length === 0 ? (
            <div className="p-12 text-center text-slate-400 italic font-medium">
              No applications found matching your criteria.
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              <AnimatePresence mode="popLayout">
                {applications.map((app, idx) => (
                  <motion.div 
                    key={app.id} 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: idx * 0.05, duration: 0.3 }}
                    className="p-5 space-y-4 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors relative group"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">{app.companyName}</h3>
                          <div className={`w-1.5 h-1.5 rounded-full ${app.status === 'Replied' ? 'bg-purple-500 animate-pulse' : 'bg-slate-300'}`} />
                        </div>
                        <a 
                          href={`https://mail.google.com/mail/u/0/#search/to:${app.email}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-black text-primary hover:underline transition-colors inline-flex items-center gap-1 uppercase tracking-widest opacity-80"
                        >
                          {app.email}
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                         <button 
                          onClick={() => openNotes(app)}
                          className="p-2.5 text-slate-400 hover:text-primary bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 transition-all active:scale-90"
                         >
                           <Edit3 className="w-4 h-4" />
                         </button>
                         <button 
                          onClick={() => handleDelete(app.id)}
                          className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all active:scale-90"
                         >
                           <Trash2 className="w-4 h-4" />
                         </button>
                      </div>
                    </div>

                    <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/60">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em]">Deployment Date</span>
                        <span className="text-xs font-black text-slate-600 dark:text-slate-400">{format(new Date(app.sentAt), "MMM d, yyyy")}</span>
                      </div>
                      <div className="relative inline-block">
                        <select
                          value={app.status}
                          onChange={(e) => handleStatusChange(app.id, e.target.value as ApplicationStatus)}
                          className={cn(
                            "appearance-none pl-4 pr-10 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 cursor-pointer focus:outline-none transition-all shadow-sm active:scale-95",
                            statusColors[app.status as ApplicationStatus] || statusColors["Applied"]
                          )}
                        >
                          {Object.keys(statusColors).map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m6 9 6 6 6-6"/></svg>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Desktop-friendly table view (hidden on mobile) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-border text-sm font-semibold text-muted-foreground">
                <th className="px-6 py-4">Company</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Sent Date</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <AnimatePresence mode="popLayout">
                {isLoading ? (
                  <motion.tr 
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                    </td>
                  </motion.tr>
                ) : applications.length === 0 ? (
                  <motion.tr 
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                      No applications found matching your criteria.
                    </td>
                  </motion.tr>
                ) : (
                  applications.map((app) => (
                    <motion.tr 
                      key={app.id} 
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group"
                    >
                      <td className="px-6 py-4 font-black text-foreground uppercase tracking-tight">{app.companyName}</td>
                      <td className="px-6 py-4 text-sm">
                        <a 
                          href={`https://mail.google.com/mail/u/0/#search/to:${app.email}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline hover:text-primary/80 transition-colors inline-flex items-center gap-1 font-black uppercase tracking-widest text-[11px]"
                        >
                          {app.email}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-500 text-xs uppercase tracking-tight">
                        {format(new Date(app.sentAt), "MMM d, yyyy")}
                      </td>
                      <td className="px-6 py-4">
                        <div className="relative inline-block">
                          <select
                            value={app.status}
                            onChange={(e) => handleStatusChange(app.id, e.target.value as ApplicationStatus)}
                            className={cn(
                              "appearance-none pl-4 pr-10 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 cursor-pointer focus:outline-none transition-all shadow-sm active:scale-95",
                              statusColors[app.status as ApplicationStatus] || statusColors["Applied"]
                            )}
                          >
                            {Object.keys(statusColors).map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                        <button 
                          onClick={() => openNotes(app)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-slate-600 hover:text-primary hover:bg-primary/5 rounded-xl transition-colors border border-transparent hover:border-primary/10"
                        >
                          <Edit3 className="w-4 h-4" />
                          Notes
                        </button>
                        <button 
                          onClick={() => handleDelete(app.id)}
                          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all active:scale-90"
                          title="Delete record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      <Modal 
        isOpen={notesModal.isOpen} 
        onClose={() => setNotesModal({ isOpen: false, app: null })}
        title={`Notes: ${notesModal.app?.companyName}`}
        description="Update internal notes for this application."
      >
        <div className="space-y-4">
          <textarea
            value={editingNotes}
            onChange={(e) => setEditingNotes(e.target.value)}
            placeholder="E.g. Met recruiter at a job fair, follow up next Tuesday..."
            rows={5}
            className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all resize-none"
          />
          <div className="flex justify-end gap-3 pt-2">
            <button 
              onClick={() => setNotesModal({ isOpen: false, app: null })}
              className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={saveNotes}
              className="px-5 py-2 font-semibold bg-primary text-white rounded-xl shadow-lg shadow-primary/25 hover:-translate-y-0.5 hover:shadow-xl transition-all flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> Save Notes
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
