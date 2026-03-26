"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { Application } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Clock, 
  Send, 
  Loader2, 
  ChevronRight, 
  AlertCircle,
  BellRing,
  CheckCircle2,
  ExternalLink,
  Calendar
} from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

export function FollowUpWidget() {
  const { toast } = useToast();
  const { data: dueApps = [], isLoading } = useQuery<Application[]>({
    queryKey: ["/api/applications/follow-ups-due"],
  });

  const sendFollowUpMutation = useMutation({
    mutationFn: async (appId: string) => {
      const res = await apiRequest("POST", `/api/applications/${appId}/followup/send`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications/follow-ups-due"] });
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      toast({
        title: "Follow-up Sent",
        description: "The follow-up email has been sent successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const sendAllMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(dueApps.map(app => apiRequest("POST", `/api/applications/${app.id}/followup/send`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications/follow-ups-due"] });
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      toast({
        title: "All Follow-ups Sent",
        description: `Successfully sent ${dueApps.length} follow-up emails.`,
      });
    },
  });

  if (isLoading) return null;
  if (dueApps.length === 0) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border-2 border-primary/20 rounded-2xl overflow-hidden shadow-xl shadow-primary/5 mb-10"
    >
      <div className="bg-primary/5 px-6 py-5 flex items-center justify-between border-b border-primary/10">
        <div className="flex items-center gap-3">
          <div className="bg-primary text-primary-foreground p-2 rounded-xl shadow-lg shadow-primary/20">
            <BellRing className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="font-bold text-foreground text-lg">Follow-Ups Due Today</h2>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              {dueApps.length} action{dueApps.length > 1 ? 's' : ''} required
            </p>
          </div>
        </div>
        <button
          onClick={() => sendAllMutation.mutate()}
          disabled={sendAllMutation.isPending}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/20 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50"
        >
          {sendAllMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Send All Now
        </button>
      </div>

      <div className="p-2">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          <AnimatePresence mode="popLayout">
            {dueApps.map((app) => (
              <motion.div
                key={app.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="group flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    {app.companyName.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-foreground truncate">{app.companyName}</p>
                    <div className="flex flex-col gap-1">
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium italic">
                        <Calendar className="w-2.5 h-2.5" /> Sent: {format(new Date(app.sentAt), "MMM d, yyyy")}
                      </p>
                      <p className="text-[10px] text-red-500 flex items-center gap-1 font-bold">
                        <Clock className="w-3 h-3" /> Due since {format(new Date(app.sentAt), "MMM d")}
                      </p>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <a
                        href={`https://mail.google.com/mail/u/0/#search/to:${app.email}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-[10px] text-primary hover:underline flex items-center gap-0.5 font-bold"
                      >
                        Gmail <ExternalLink className="w-2 h-2" />
                      </a>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => sendFollowUpMutation.mutate(app.id)}
                  disabled={sendFollowUpMutation.isPending}
                  className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 group-hover:bg-primary group-hover:text-primary-foreground transition-all shadow-sm"
                >
                  {sendFollowUpMutation.isPending && sendFollowUpMutation.variables === app.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
