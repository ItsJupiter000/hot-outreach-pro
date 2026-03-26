"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Document, DocumentType } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, FileUp, Trash2, CheckCircle2, FileText, Files } from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

export default function Documents() {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [docType, setDocType] = useState<DocumentType>("Resume");

  const { data: documents = [], isLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({ title: "Success", description: "Document uploaded successfully" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({ title: "Deleted", description: "Document removed" });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/documents/${id}/default`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({ title: "Success", description: "Default document updated" });
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", docType);
    formData.append("name", file.name);

    try {
      await uploadMutation.mutateAsync(formData);
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Failed to upload document" });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
        <div>
          <h1 className="text-4xl font-display font-black text-foreground tracking-tight">Resource Vault</h1>
          <p className="text-muted-foreground mt-2 font-medium italic">Manage resumes, cover letters, and tactical brief assets.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch gap-3 w-full lg:w-auto bg-slate-100 dark:bg-slate-900/50 p-2 rounded-3xl border border-slate-200 dark:border-slate-800">
          <select 
            value={docType}
            onChange={e => setDocType(e.target.value as DocumentType)}
            className="px-6 py-3.5 bg-white dark:bg-slate-800 border-none rounded-2xl text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer text-center sm:text-left shadow-sm"
          >
            <option value="Resume">Resume</option>
            <option value="Cover Letter">Cover Letter</option>
            <option value="Portfolio">Portfolio</option>
            <option value="Other">Other</option>
          </select>
          <label className="flex-1 sm:flex-none flex items-center justify-center gap-3 px-8 py-3.5 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-1 active:translate-y-0 transition-all cursor-pointer whitespace-nowrap group">
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />}
            <span>Upload New Asset</span>
            <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
        <AnimatePresence mode="popLayout">
          {isLoading ? (
            <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-10 h-10 animate-spin mb-4 opacity-20" />
              <p className="text-[10px] font-black uppercase tracking-widest">Scanning encrypted modules...</p>
            </div>
          ) : documents.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="col-span-full py-24 text-center bg-slate-50/50 dark:bg-slate-900/10 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800 px-6"
            >
              <div className="w-20 h-20 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-6">
                 <Files className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest leading-relaxed">System vault empty. Upload your first tactical resource above.</p>
            </motion.div>
          ) : (
            documents.map((doc, idx) => (
              <motion.div 
                key={doc.id} 
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-card rounded-[2rem] border border-border/60 p-6 shadow-xl shadow-slate-200/40 dark:shadow-none hover:shadow-2xl hover:border-primary/20 transition-all group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <div className="flex items-start gap-5 relative z-10">
                  <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl text-slate-400 group-hover:text-primary group-hover:bg-primary/5 transition-all duration-300 shadow-inner shrink-0 leading-none">
                    <FileText className="w-7 h-7" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-slate-900 dark:text-white text-lg truncate uppercase tracking-tight mb-1">{doc.name}</h3>
                    <div className="flex items-center gap-2">
                       <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest border border-slate-200 dark:border-slate-700">{doc.type}</span>
                       <span className="text-[10px] font-bold text-slate-300 dark:text-slate-600">â€¢</span>
                       <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">{format(new Date(doc.createdAt), "MMM d, yyyy")}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 relative z-10">
                  {!doc.isDefault ? (
                    <button 
                      onClick={() => setDefaultMutation.mutate(doc.id)}
                      className="flex-1 h-11 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-primary hover:bg-primary/5 rounded-xl transition-all border border-transparent hover:border-primary/10"
                    >
                      <Plus className="w-3.5 h-3.5" /> Set Default
                    </button>
                  ) : (
                    <div className="flex-1 h-11 flex items-center justify-center gap-2 px-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                       <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                       <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Active {doc.type}</span>
                    </div>
                  )}
                  <button 
                    onClick={() => {
                      if (confirm("Initiate deletion protocol for this asset?")) {
                        deleteMutation.mutate(doc.id);
                      }
                    }}
                    className="w-11 h-11 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all border border-transparent hover:border-red-100 dark:hover:border-red-900/30"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
