"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { User, Mail, Briefcase, Phone, MapPin, Link2, FileText, Server, Save, Loader2 } from "lucide-react";
import type { Profile } from "@shared/schema";

export default function ProfilePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery<Profile>({
    queryKey: ["/api/profile"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const [form, setForm] = useState({
    fullName: "",
    role: "",
    phone: "",
    linkedinUrl: "",
    portfolioUrl: "",
    location: "",
    bio: "",
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPass: "",
  });

  useEffect(() => {
    if (profile) {
      setForm({
        fullName: profile.fullName || "",
        role: profile.role || "",
        phone: profile.phone || "",
        linkedinUrl: profile.linkedinUrl || "",
        portfolioUrl: profile.portfolioUrl || "",
        location: profile.location || "",
        bio: profile.bio || "",
        smtpHost: profile.smtpHost || "",
        smtpPort: profile.smtpPort || 587,
        smtpUser: profile.smtpUser || "",
        smtpPass: profile.smtpPass || "",
      });
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: async (updates: typeof form) => {
      const res = await apiRequest("PATCH", "/api/profile", updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({ title: "Profile updated", description: "Your changes have been saved." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(form);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground mt-1">
          Your personal info and email variables used in templates
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* Personal Information */}
        <div className="bg-card rounded-2xl border p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b">
            <div className="bg-primary/10 p-2 rounded-xl">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">Personal Information</h2>
              <p className="text-sm text-muted-foreground">
                Used as <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{"{{myName}}"}</code> and <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{"{{myRole}}"}</code> in templates
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                Full Name
              </label>
              <input
                type="text"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="John Doe"
                className="w-full px-4 py-2.5 bg-background border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                Email
              </label>
              <input
                type="email"
                value={profile?.email || ""}
                disabled
                className="w-full px-4 py-2.5 bg-muted border rounded-xl text-muted-foreground cursor-not-allowed"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-muted-foreground" />
                Role / Title
              </label>
              <input
                type="text"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                placeholder="Software Engineer"
                className="w-full px-4 py-2.5 bg-background border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground" />
                Phone
              </label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+1 234 567 8900"
                className="w-full px-4 py-2.5 bg-background border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                Location
              </label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="San Francisco, CA"
                className="w-full px-4 py-2.5 bg-background border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Link2 className="w-4 h-4 text-muted-foreground" />
                LinkedIn URL
              </label>
              <input
                type="url"
                value={form.linkedinUrl}
                onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })}
                placeholder="https://linkedin.com/in/yourname"
                className="w-full px-4 py-2.5 bg-background border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Link2 className="w-4 h-4 text-muted-foreground" />
                Portfolio URL
              </label>
              <input
                type="url"
                value={form.portfolioUrl}
                onChange={(e) => setForm({ ...form, portfolioUrl: e.target.value })}
                placeholder="https://yourportfolio.com"
                className="w-full px-4 py-2.5 bg-background border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                Bio
              </label>
              <textarea
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                rows={3}
                placeholder="A brief professional summary..."
                className="w-full px-4 py-2.5 bg-background border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none"
              />
            </div>
          </div>
        </div>

        {/* Email Variables Reference */}
        <div className="bg-card rounded-2xl border p-6 space-y-4">
          <div className="flex items-center gap-3 pb-4 border-b">
            <div className="bg-amber-500/10 p-2 rounded-xl">
              <Mail className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">Template Variables</h2>
              <p className="text-sm text-muted-foreground">Use these in your email templates</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { var: "{{myName}}", desc: "Your full name", val: form.fullName },
              { var: "{{myEmail}}", desc: "Your email address", val: profile?.email },
              { var: "{{myRole}}", desc: "Your role/title", val: form.role },
              { var: "{{myPhone}}", desc: "Your phone number", val: form.phone },
              { var: "{{myLocation}}", desc: "Your location", val: form.location },
              { var: "{{myLinkedin}}", desc: "Your LinkedIn URL", val: form.linkedinUrl },
              { var: "{{myPortfolio}}", desc: "Your portfolio URL", val: form.portfolioUrl },
              { var: "{{companyName}}", desc: "Recipient company (set per email)", val: "—" },
            ].map((item) => (
              <div
                key={item.var}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-xl text-sm"
              >
                <div>
                  <code className="text-primary font-mono text-xs bg-primary/10 px-2 py-0.5 rounded">
                    {item.var}
                  </code>
                  <span className="text-muted-foreground ml-2">{item.desc}</span>
                </div>
                <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                  {item.val || "Not set"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* SMTP Settings */}
        <div className="bg-card rounded-2xl border p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b">
            <div className="bg-blue-500/10 p-2 rounded-xl">
              <Server className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">SMTP Settings</h2>
              <p className="text-sm text-muted-foreground">Email sending configuration for your account</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">SMTP Host</label>
              <input
                type="text"
                value={form.smtpHost}
                onChange={(e) => setForm({ ...form, smtpHost: e.target.value })}
                placeholder="smtp.gmail.com"
                className="w-full px-4 py-2.5 bg-background border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">SMTP Port</label>
              <input
                type="number"
                value={form.smtpPort}
                onChange={(e) => setForm({ ...form, smtpPort: parseInt(e.target.value) || 587 })}
                placeholder="587"
                className="w-full px-4 py-2.5 bg-background border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">SMTP User</label>
              <input
                type="email"
                value={form.smtpUser}
                onChange={(e) => setForm({ ...form, smtpUser: e.target.value })}
                placeholder="you@gmail.com"
                className="w-full px-4 py-2.5 bg-background border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">SMTP Password</label>
              <input
                type="password"
                value={form.smtpPass}
                onChange={(e) => setForm({ ...form, smtpPass: e.target.value })}
                placeholder="App password"
                className="w-full px-4 py-2.5 bg-background border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {updateMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
