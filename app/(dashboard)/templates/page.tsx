"use client";

import { useState } from "react";
import { useTemplates, useCreateTemplate, useDeleteTemplate, useUpdateTemplate } from "@/hooks/use-templates";
import { Modal } from "@/components/ui/Modal";
import { Template } from "@shared/schema";
import { Plus, Trash2, FileText, Loader2, Star, Pencil } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

type TemplateForm = { name: string; subject: string; content: string };
const emptyForm: TemplateForm = { name: "", subject: "", content: "" };

const inputClass = "w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all";

function TemplateFormFields({
  form,
  setForm,
}: {
  form: TemplateForm;
  setForm: (f: TemplateForm) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Template Name</label>
        <input
          required
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. Standard Cold Outreach"
          className={inputClass}
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Email Subject</label>
        <input
          required
          value={form.subject}
          onChange={e => setForm({ ...form, subject: e.target.value })}
          placeholder="e.g. Exploring opportunities at {{companyName}}"
          className={inputClass}
        />
        <p className="text-xs text-muted-foreground">Supports: {"{{companyName}}"}</p>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Email Body</label>
        <textarea
          required
          value={form.content}
          onChange={e => setForm({ ...form, content: e.target.value })}
          placeholder="Hi Team, I'm reaching out about..."
          rows={10}
          className={`${inputClass} resize-none font-sans`}
        />
        <p className="text-xs text-muted-foreground">
          Variables: {"{{companyName}}"}, {"{{myName}}"}, {"{{myRole}}"}, {"{{customMessage}}"}
        </p>
      </div>
    </div>
  );
}

export default function Templates() {
  const { data: templates = [], isLoading } = useTemplates();
  const { mutate: createTemplate, isPending: isCreating } = useCreateTemplate();
  const { mutate: updateTemplate, isPending: isUpdating } = useUpdateTemplate();
  const { mutate: deleteTemplate } = useDeleteTemplate();
  const { toast } = useToast();

  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/templates/${id}/default`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({ title: "Success", description: "Default template updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to set default template.", variant: "destructive" });
    },
  });

  const [createModal, setCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<TemplateForm>(emptyForm);

  const [editTarget, setEditTarget] = useState<Template | null>(null);
  const [editForm, setEditForm] = useState<TemplateForm>(emptyForm);

  const openEdit = (t: Template) => {
    setEditTarget(t);
    setEditForm({ name: t.name, subject: t.subject, content: t.content });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createTemplate(createForm, {
      onSuccess: () => {
        setCreateModal(false);
        setCreateForm(emptyForm);
      },
    });
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    updateTemplate({ id: editTarget.id, data: editForm }, {
      onSuccess: () => setEditTarget(null),
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this template?")) {
      deleteTemplate(id);
    }
  };

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <h1 className="text-4xl font-display font-black text-foreground tracking-tight">Script Library</h1>
          <p className="text-muted-foreground mt-2 font-medium italic">Precision-engineered email blueprints for high-octane outreach.</p>
        </div>
        <button
          onClick={() => setCreateModal(true)}
          className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] bg-primary text-white shadow-xl shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-1 active:translate-y-0 transition-all duration-300 w-full md:w-auto overflow-hidden relative group"
        >
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          <Plus className="w-5 h-5 relative z-10" />
          <span className="relative z-10">Forge New Blueprint</span>
        </button>
      </div>

      <div className="pb-24">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-10 h-10 animate-spin mb-4 opacity-20" />
            <p className="text-[10px] font-black uppercase tracking-widest">Accessing blueprint database...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {templates.map((template, idx) => (
                <motion.div 
                  key={template.id} 
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-card rounded-[2.5rem] p-7 shadow-xl shadow-slate-200/40 dark:shadow-none border border-border/50 hover:border-primary/20 hover:shadow-2xl transition-all duration-500 flex flex-col group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full -mr-20 -mt-20 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                  
                  {template.isDefault && (
                    <div className="absolute top-6 right-6 bg-primary text-white p-2 rounded-xl shadow-lg z-10 rotate-12 transition-transform group-hover:rotate-0" title="Primary Tactical Blueprint">
                      <Star className="w-4 h-4 fill-current" />
                    </div>
                  )}

                  <div className="flex items-start justify-between mb-6 relative z-10">
                    <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl text-slate-400 group-hover:text-primary group-hover:bg-primary/5 transition-all duration-300 shadow-inner">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                      <button
                        onClick={() => openEdit(template)}
                        className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all border border-transparent hover:border-primary/10"
                        title="Edit Blueprint"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(template.id)}
                        className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all border border-transparent hover:border-red-100 dark:hover:border-red-900/30"
                        title="Delete Blueprint"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1 uppercase tracking-tight group-hover:text-primary transition-colors">{template.name}</h3>
                  <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 mb-6 uppercase tracking-widest truncate">
                    Subject: <span className="text-slate-600 dark:text-slate-400">{template.subject}</span>
                  </p>

                  <div className="flex-1 bg-slate-50 dark:bg-slate-900/50 rounded-[1.5rem] p-5 text-sm font-medium text-slate-500 dark:text-slate-400 line-clamp-4 relative overflow-hidden mb-6 border border-slate-100 dark:border-slate-800 shadow-inner">
                    {template.content.replace(/<[^>]+>/g, " ")}
                    <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-slate-50 dark:from-slate-900/50 to-transparent pointer-events-none" />
                  </div>

                  <div className="pt-5 border-t border-slate-100 dark:border-slate-800 relative z-10">
                    {!template.isDefault ? (
                      <button
                        onClick={() => setDefaultMutation.mutate(template.id)}
                        disabled={setDefaultMutation.isPending}
                        className="w-full flex items-center justify-center gap-2 h-12 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all border border-transparent hover:border-primary/10"
                      >
                        <Star className="w-3.5 h-3.5" />
                        Activate as Primary
                      </button>
                    ) : (
                      <div className="w-full flex items-center justify-center gap-2 h-12 bg-primary/5 border border-primary/20 rounded-xl">
                        <Star className="w-3.5 h-3.5 fill-primary text-primary animate-pulse" />
                        <span className="text-[10px] font-black text-primary uppercase tracking-widest">Primary Objective</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}

              {templates.length === 0 && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="col-span-full py-24 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[3rem] bg-slate-50/50 dark:bg-slate-900/10"
                >
                  <FileText className="w-16 h-16 text-slate-200 dark:text-slate-800 mx-auto mb-6" />
                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Arsenal Empty</h3>
                  <p className="text-slate-400 dark:text-slate-500 mt-2 font-medium italic">Forging high-quality blueprints is the first step to total dominance.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal isOpen={createModal} onClose={() => setCreateModal(false)} title="Create New Template">
        <form onSubmit={handleCreate} className="space-y-4">
          <TemplateFormFields form={createForm} setForm={setCreateForm} />
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => setCreateModal(false)}
              className="px-4 py-2.5 font-medium text-muted-foreground hover:bg-muted rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="px-6 py-2.5 font-semibold bg-primary text-primary-foreground rounded-xl shadow-lg shadow-primary/25 hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-50 disabled:transform-none transition-all flex items-center gap-2"
            >
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Template"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Template">
        <form onSubmit={handleEdit} className="space-y-4">
          <TemplateFormFields form={editForm} setForm={setEditForm} />
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => setEditTarget(null)}
              className="px-4 py-2.5 font-medium text-muted-foreground hover:bg-muted rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUpdating}
              className="px-6 py-2.5 font-semibold bg-primary text-primary-foreground rounded-xl shadow-lg shadow-primary/25 hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-50 disabled:transform-none transition-all flex items-center gap-2"
            >
              {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
