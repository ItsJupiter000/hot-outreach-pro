import { Application, InsertTemplate, Template, UpdateApplication, Document, InsertDocument, Settings, UpdateSettings, Profile, UpdateProfile } from "@shared/schema";
import { supabase } from "./supabaseClient";
import { randomUUID } from "crypto";

export interface IStorage {
  // Templates
  getTemplates(userId: string): Promise<Template[]>;
  getTemplate(id: string): Promise<Template | undefined>;
  createTemplate(userId: string, template: InsertTemplate): Promise<Template>;
  updateTemplate(id: string, updates: InsertTemplate): Promise<Template>;
  deleteTemplate(id: string): Promise<void>;
  setDefaultTemplate(userId: string, id: string): Promise<Template>;

  // Applications
  getApplications(userId: string): Promise<Application[]>;
  getApplication(id: string): Promise<Application | undefined>;
  createApplication(userId: string, app: Omit<Application, "id" | "history">): Promise<Application>;
  updateApplication(id: string, updates: UpdateApplication): Promise<Application>;
  updateFollowUp(id: string, templateId: string | null, days: number | null): Promise<Application>;
  deleteApplication(id: string): Promise<void>;
  checkDuplicateSend(userId: string, companyName: string, email: string): Promise<boolean>;

  // Documents
  getDocuments(userId: string): Promise<Document[]>;
  getDocument(id: string): Promise<Document | undefined>;
  getDefaultDocument(userId: string, type: string): Promise<Document | undefined>;
  createDocument(userId: string, doc: InsertDocument): Promise<Document>;
  deleteDocument(id: string): Promise<void>;
  setDefaultDocument(userId: string, id: string): Promise<Document>;

  // Settings
  getSettings(userId: string): Promise<Settings>;
  updateSettings(userId: string, updates: UpdateSettings): Promise<Settings>;

  // Profile
  getProfile(userId: string): Promise<Profile | null>;
  updateProfile(userId: string, updates: UpdateProfile): Promise<Profile>;
}

function mapRowToTemplate(row: any): Template {
  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    content: row.content,
    isDefault: row.is_default ?? false,
  };
}

function mapRowToApplication(row: any): Application {
  return {
    id: row.id,
    companyName: row.company_name,
    email: row.email,
    templateId: row.template_id,
    status: row.status,
    sentAt: typeof row.sent_at === "string" ? row.sent_at : new Date(row.sent_at).toISOString(),
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : new Date(row.updated_at).toISOString(),
    notes: row.notes ?? undefined,
    history: Array.isArray(row.history) ? row.history : [],
    followUpTemplateId: row.follow_up_template_id ?? null,
    followUpDays: row.follow_up_days ?? null,
    followUpSentAt: row.follow_up_sent_at ?? null,
  };
}

function mapRowToDocument(row: any): Document {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    filePath: row.file_path,
    fileName: row.file_name,
    isDefault: row.is_default,
    createdAt: typeof row.created_at === "string" ? row.created_at : new Date(row.created_at).toISOString(),
  };
}

function mapRowToSettings(row: any): Settings {
  return {
    id: row.user_id,
    followUpsEnabled: row.follow_ups_enabled,
    schedulingEnabled: row.scheduling_enabled,
    replyPollingEnabled: row.reply_polling_enabled,
    followUpIntervalMinutes: row.follow_up_interval_minutes,
    schedulingIntervalMinutes: row.scheduling_interval_minutes,
    replyPollingIntervalMinutes: row.reply_polling_interval_minutes,
    followUpTemplateId: row.follow_up_template_id,
    followUpDays: row.follow_up_days,
    lastFollowUpAt: row.last_follow_up_at ? new Date(row.last_follow_up_at).toISOString() : null,
    lastSchedulingAt: row.last_scheduling_at ? new Date(row.last_scheduling_at).toISOString() : null,
    lastReplyPollingAt: row.last_reply_polling_at ? new Date(row.last_reply_polling_at).toISOString() : null,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : new Date(row.updated_at).toISOString(),
  };
}

function mapRowToProfile(row: any): Profile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    phone: row.phone,
    linkedinUrl: row.linkedin_url,
    portfolioUrl: row.portfolio_url,
    location: row.location,
    bio: row.bio,
    smtpHost: row.smtp_host,
    smtpPort: row.smtp_port,
    smtpUser: row.smtp_user,
    smtpPass: row.smtp_pass,
    createdAt: typeof row.created_at === "string" ? row.created_at : new Date(row.created_at).toISOString(),
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : new Date(row.updated_at).toISOString(),
  };
}

export class SupabaseStorage implements IStorage {
  // ─── Templates ──────────────────────────────────────────────────────────────

  async getTemplates(userId: string): Promise<Template[]> {
    const { data, error } = await supabase.from("templates").select("*").eq("user_id", userId).order("name");
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapRowToTemplate);
  }

  async getTemplate(id: string): Promise<Template | undefined> {
    const { data, error } = await supabase.from("templates").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapRowToTemplate(data) : undefined;
  }

  async createTemplate(userId: string, insertTemplate: InsertTemplate): Promise<Template> {
    // If no templates exist yet, make this one the default
    const existing = await this.getTemplates(userId);
    const isFirst = existing.length === 0;
    const { data, error } = await supabase
      .from("templates")
      .insert({ id: randomUUID(), ...insertTemplate, is_default: isFirst, user_id: userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapRowToTemplate(data);
  }

  async updateTemplate(id: string, updates: InsertTemplate): Promise<Template> {
    const { data, error } = await supabase
      .from("templates")
      .update({ name: updates.name, subject: updates.subject, content: updates.content })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapRowToTemplate(data);
  }

  async deleteTemplate(id: string): Promise<void> {
    const { error } = await supabase.from("templates").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  async setDefaultTemplate(userId: string, id: string): Promise<Template> {
    const template = await this.getTemplate(id);
    if (!template) throw new Error("Template not found");
    // Clear all defaults for this user
    await supabase.from("templates").update({ is_default: false }).eq("user_id", userId);
    // Set new default
    const { data, error } = await supabase
      .from("templates")
      .update({ is_default: true })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapRowToTemplate(data);
  }

  // ─── Applications ────────────────────────────────────────────────────────────

  async getApplications(userId: string): Promise<Application[]> {
    const { data, error } = await supabase.from("applications").select("*").eq("user_id", userId).order("sent_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapRowToApplication);
  }

  async getApplication(id: string): Promise<Application | undefined> {
    const { data, error } = await supabase.from("applications").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapRowToApplication(data) : undefined;
  }

  async createApplication(userId: string, appData: Omit<Application, "id" | "history">): Promise<Application> {
    const id = randomUUID();
    const history = [{ status: appData.status, date: appData.sentAt }];

    const { data, error } = await supabase
      .from("applications")
      .insert({
        id,
        user_id: userId,
        company_name: appData.companyName,
        email: appData.email,
        template_id: appData.templateId,
        status: appData.status,
        sent_at: appData.sentAt,
        updated_at: appData.updatedAt,
        notes: appData.notes ?? null,
        history,
        follow_up_template_id: appData.followUpTemplateId ?? null,
        follow_up_days: appData.followUpDays ?? null,
        follow_up_sent_at: null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapRowToApplication(data);
  }

  async markFollowUpSent(id: string): Promise<void> {
    const { error } = await supabase
      .from("applications")
      .update({ follow_up_sent_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
  }

  async getApplicationsDueForFollowUp(userId: string): Promise<Application[]> {
    // Get global settings for fallbacks
    const settings = await this.getSettings(userId);
    
    // Get all apps that are in a state eligible for follow-up and haven't had one sent yet
    const { data, error } = await supabase
      .from("applications")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["Applied", "Opened"])
      .is("follow_up_sent_at", null);
    
    if (error) throw new Error(error.message);
    const apps = (data ?? []).map(mapRowToApplication);
    const now = Date.now();

    return apps.filter((app) => {
      // Use app-specific value if present, else fallback to global setting
      const templateId = app.followUpTemplateId || settings.followUpTemplateId;
      const days = app.followUpDays || settings.followUpDays;

      if (!templateId || !days) return false;

      const sentAt = new Date(app.sentAt).getTime();
      const delayMs = days * 24 * 60 * 60 * 1000;
      return now >= sentAt + delayMs;
    });
  }

  async updateFollowUp(id: string, templateId: string | null, days: number | null): Promise<Application> {
    const { data, error } = await supabase
      .from("applications")
      .update({
        follow_up_template_id: templateId,
        follow_up_days: days,
        follow_up_sent_at: null, // reset sent flag so it can fire again if re-enabled
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapRowToApplication(data);
  }

  async updateApplication(id: string, updates: UpdateApplication): Promise<Application> {
    const existing = await this.getApplication(id);
    if (!existing) throw new Error("Application not found");

    const now = new Date().toISOString();
    const newHistory = [...existing.history];

    if (updates.status && updates.status !== existing.status) {
      newHistory.push({ status: updates.status, date: now });
    }

    const { data, error } = await supabase
      .from("applications")
      .update({
        ...(updates.status ? { status: updates.status } : {}),
        ...(updates.notes !== undefined ? { notes: updates.notes } : {}),
        updated_at: now,
        history: newHistory,
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapRowToApplication(data);
  }

  async deleteApplication(id: string): Promise<void> {
    const { error } = await supabase.from("applications").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  async checkDuplicateSend(userId: string, companyName: string, email: string): Promise<boolean> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("applications")
      .select("id")
      .eq("user_id", userId)
      .ilike("company_name", companyName)
      .ilike("email", email)
      .gte("sent_at", oneDayAgo);
    if (error) throw new Error(error.message);
    return (data ?? []).length > 0;
  }

  // ─── Documents ──────────────────────────────────────────────────────────────

  async getDocuments(userId: string): Promise<Document[]> {
    const { data, error } = await supabase.from("documents").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapRowToDocument);
  }

  async getDocument(id: string): Promise<Document | undefined> {
    const { data, error } = await supabase.from("documents").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapRowToDocument(data) : undefined;
  }

  async getDefaultDocument(userId: string, type: string): Promise<Document | undefined> {
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("user_id", userId)
      .eq("type", type)
      .eq("is_default", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapRowToDocument(data) : undefined;
  }

  async createDocument(userId: string, doc: InsertDocument): Promise<Document> {
    // If this is marked as default (or first of its type), clear existing defaults
    if (doc.isDefault) {
      await supabase.from("documents").update({ is_default: false }).eq("user_id", userId).eq("type", doc.type);
    } else {
      // Check if any of same type already exist; if not, make this default
      const { data: existing } = await supabase.from("documents").select("id").eq("user_id", userId).eq("type", doc.type);
      if (!existing || existing.length === 0) {
        doc = { ...doc, isDefault: true };
      }
    }

    const id = randomUUID();
    const { data, error } = await supabase
      .from("documents")
      .insert({
        id,
        user_id: userId,
        name: doc.name,
        type: doc.type,
        file_path: doc.filePath,
        file_name: doc.fileName,
        is_default: doc.isDefault,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapRowToDocument(data);
  }

  async deleteDocument(id: string): Promise<void> {
    // Also delete the file from Supabase Storage
    const doc = await this.getDocument(id);
    if (doc?.filePath) {
      // file_path stores the storage path e.g. "documents/filename.pdf"
      const storagePath = doc.filePath.replace(/^documents\//, "");
      await supabase.storage.from("documents").remove([storagePath]);
    }
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  async setDefaultDocument(userId: string, id: string): Promise<Document> {
    const doc = await this.getDocument(id);
    if (!doc) throw new Error("Document not found");

    // Clear existing defaults for same type for this user
    await supabase.from("documents").update({ is_default: false }).eq("user_id", userId).eq("type", doc.type);

    const { data, error } = await supabase
      .from("documents")
      .update({ is_default: true })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapRowToDocument(data);
  }

  // ─── Settings ─────────────────────────────────────────────────────────────

  async getSettings(userId: string): Promise<Settings> {
    const { data, error } = await supabase
      .from("settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    
    if (error) throw new Error(error.message);
    if (!data) {
      // Create if doesn't exist (safety)
      const { data: newData, error: createError } = await supabase
        .from("settings")
        .insert({ 
          user_id: userId, 
          follow_ups_enabled: true, 
          scheduling_enabled: true, 
          reply_polling_enabled: true,
          follow_up_interval_minutes: 60,
          scheduling_interval_minutes: 360,
          reply_polling_interval_minutes: 5
        })
        .select()
        .single();
      if (createError) throw new Error(createError.message);
      return mapRowToSettings(newData);
    }
    return mapRowToSettings(data);
  }

  async updateSettings(userId: string, updates: UpdateSettings): Promise<Settings> {
    const dbUpdates: any = {
      updated_at: new Date().toISOString()
    };
    if (updates.followUpsEnabled !== undefined) dbUpdates.follow_ups_enabled = updates.followUpsEnabled;
    if (updates.schedulingEnabled !== undefined) dbUpdates.scheduling_enabled = updates.schedulingEnabled;
    if (updates.replyPollingEnabled !== undefined) dbUpdates.reply_polling_enabled = updates.replyPollingEnabled;
    if (updates.followUpIntervalMinutes !== undefined) dbUpdates.follow_up_interval_minutes = updates.followUpIntervalMinutes;
    if (updates.schedulingIntervalMinutes !== undefined) dbUpdates.scheduling_interval_minutes = updates.schedulingIntervalMinutes;
    if (updates.replyPollingIntervalMinutes !== undefined) dbUpdates.reply_polling_interval_minutes = updates.replyPollingIntervalMinutes;
    if (updates.followUpTemplateId !== undefined) dbUpdates.follow_up_template_id = updates.followUpTemplateId;
    if (updates.followUpDays !== undefined) dbUpdates.follow_up_days = updates.followUpDays;
    if (updates.lastFollowUpAt !== undefined) dbUpdates.last_follow_up_at = updates.lastFollowUpAt;
    if (updates.lastSchedulingAt !== undefined) dbUpdates.last_scheduling_at = updates.lastSchedulingAt;
    if (updates.lastReplyPollingAt !== undefined) dbUpdates.last_reply_polling_at = updates.lastReplyPollingAt;

    const { data, error } = await supabase
      .from("settings")
      .update(dbUpdates)
      .eq("user_id", userId)
      .select()
      .single();
    
    if (error) throw new Error(error.message);
    return mapRowToSettings(data);
  }

  // ─── Profile ──────────────────────────────────────────────────────────────

  async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapRowToProfile(data) : null;
  }

  async updateProfile(userId: string, updates: UpdateProfile): Promise<Profile> {
    const dbUpdates: any = { updated_at: new Date().toISOString() };
    if (updates.fullName !== undefined) dbUpdates.full_name = updates.fullName;
    if (updates.role !== undefined) dbUpdates.role = updates.role;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.linkedinUrl !== undefined) dbUpdates.linkedin_url = updates.linkedinUrl;
    if (updates.portfolioUrl !== undefined) dbUpdates.portfolio_url = updates.portfolioUrl;
    if (updates.location !== undefined) dbUpdates.location = updates.location;
    if (updates.bio !== undefined) dbUpdates.bio = updates.bio;
    if (updates.smtpHost !== undefined) dbUpdates.smtp_host = updates.smtpHost;
    if (updates.smtpPort !== undefined) dbUpdates.smtp_port = updates.smtpPort;
    if (updates.smtpUser !== undefined) dbUpdates.smtp_user = updates.smtpUser;
    if (updates.smtpPass !== undefined) dbUpdates.smtp_pass = updates.smtpPass;

    const { data, error } = await supabase
      .from("profiles")
      .update(dbUpdates)
      .eq("id", userId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapRowToProfile(data);
  }
}

export const storage = new SupabaseStorage();
