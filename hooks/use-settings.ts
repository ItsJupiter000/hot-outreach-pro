import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, UpdateSettings } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function useSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: settings, isLoading, error } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: UpdateSettings) => {
      const res = await apiRequest("PATCH", "/api/settings", updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const syncFeatureMutation = useMutation({
    mutationFn: async (feature: string) => {
      const res = await apiRequest("POST", "/api/settings/sync", { feature });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Sync Completed",
        description: data.message,
      });
      // Refresh settings to show new lastRunAt
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    settings,
    isLoading,
    error,
    updateSettings: updateSettingsMutation.mutate,
    isUpdating: updateSettingsMutation.isPending,
    syncFeature: syncFeatureMutation.mutate,
    isSyncing: syncFeatureMutation.isPending,
  };
}
