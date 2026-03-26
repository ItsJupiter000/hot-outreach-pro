"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { Loader2, Mail, Trash2, Send, ExternalLink, Calendar, Clock, ArrowRight, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

export default function Scheduled() {
  const { toast } = useToast();

  const { data: scheduled = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/scheduled"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/scheduled/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled"] });
      toast({ title: "Cancelled", description: "Scheduled email has been removed." });
    },
  });

  const sendNowMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/scheduled/${id}/send`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled"] });
      toast({ title: "Sent", description: "Email dispatched immediately." });
    },
  });

  return (
    <>
      <div className="mb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-4xl font-black text-foreground tracking-tight flex items-center gap-3">
              <Calendar className="w-10 h-10 text-primary" />
              Scheduled Queue
            </h1>
            <p className="text-muted-foreground mt-2 font-medium">Manage and review your upcoming outreach emails.</p>
          </motion.div>
          <div className="px-5 py-2.5 rounded-2xl bg-primary/10 border border-primary/20 flex items-center gap-3">
             <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
             <span className="text-sm font-bold text-primary">{scheduled.length} Emails Pending</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-muted-foreground bg-card/30 rounded-[2rem] border-2 border-dashed border-border">
            <Loader2 className="w-10 h-10 animate-spin mb-4 text-primary" />
            <p className="font-bold">Loading queued emails...</p>
          </div>
        ) : scheduled.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="py-20 flex flex-col items-center justify-center text-muted-foreground bg-card/30 rounded-[2rem] border-2 border-dashed border-border"
          >
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
              <Sparkles className="w-10 h-10 text-muted-foreground/40" />
            </div>
            <h3 className="text-xl font-bold text-foreground">Queue is clear!</h3>
            <p className="mt-2 text-sm font-medium">No scheduled emails at the moment.</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 gap-4 pb-20">
            <AnimatePresence mode="popLayout">
              {scheduled.map((email, idx) => (
                <motion.div
                  key={email.id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-card border border-border rounded-[2rem] p-5 shadow-sm hover:shadow-xl hover:border-primary/30 transition-all group overflow-hidden relative"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-primary/10 transition-colors" />
                  
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center font-black text-xl text-foreground shadow-inner border border-slate-100 dark:border-slate-800 shrink-0">
                        {email.companyName?.charAt(0) || "U"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                           <h4 className="font-black text-lg text-foreground tracking-tight truncate uppercase">{email.companyName || "Unknown Entity"}</h4>
                           <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-black uppercase tracking-widest border border-primary/20 shrink-0">Queued</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <a 
                            href={`https://mail.google.com/mail/u/0/#search/to:${email.email}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-black text-primary hover:underline flex items-center gap-1.5 uppercase tracking-widest opacity-80"
                          >
                            <Mail className="w-3 h-3" />
                            {email.email}
                          </a>
                          <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <Clock className="w-3 h-3 text-amber-500" />
                            {format(new Date(email.scheduledFor), "MMM d, h:mm a")}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 hidden md:flex">
                       <div className="w-full sm:w-auto">
                          <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Template</p>
                          <p className="text-[11px] font-black text-slate-600 dark:text-slate-400 uppercase truncate max-w-[150px]">{email.templateName || "System Default"}</p>
                       </div>
                       <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 mx-2" />
                       <div className="w-full sm:w-auto">
                          <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Source</p>
                          <p className="text-[11px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-tight">{email.host || "Direct"}</p>
                       </div>
                    </div>

                    <div className="flex items-center gap-3 w-full lg:w-auto">
                      <button
                        onClick={() => sendNowMutation.mutate(email.id)}
                        disabled={sendNowMutation.isPending}
                        className="flex-1 lg:flex-none flex items-center justify-center gap-2 h-12 px-6 bg-primary text-white rounded-[1.25rem] font-black text-[11px] uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                      >
                        {sendNowMutation.isPending && sendNowMutation.variables === email.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            Send now <ArrowRight className="w-3 h-3" />
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(email.id)}
                        disabled={deleteMutation.isPending}
                        className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-[1.25rem] transition-all border border-transparent hover:border-red-100 dark:hover:border-red-900/50"
                        title="Cancel Schedule"
                      >
                        {deleteMutation.isPending && deleteMutation.variables === email.id ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Trash2 className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </>
  );
}
