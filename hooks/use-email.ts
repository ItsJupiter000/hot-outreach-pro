import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { SendEmailRequest } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useSendEmail() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: SendEmailRequest) => {
      const validated = api.email.send.input.parse(data);
      const res = await fetch(api.email.send.path, {
        method: api.email.send.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to send email");
      }
      
      const json = await res.json();
      if (res.status === 202) {
        return json; // Scheduled response
      }
      
      return api.email.send.responses[201].parse(json);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.applications.list.path] });
      
      const isScheduled = !!variables.scheduledFor;
      
      toast({ 
        title: isScheduled ? "Email Scheduled! ⏱️" : "Email Sent Successfully! 🚀", 
        description: isScheduled ? "Your outreach will be sent at the selected time." : "Your outreach has been delivered and logged." 
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to send email", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  });
}
