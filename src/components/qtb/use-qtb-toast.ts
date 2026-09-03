"use client";

import { useToast } from "@/hooks/use-toast";
import { ApiError } from "@/lib/client-api";

/** Thin wrappers over the app toast so views stay consistent. */
export function useQtbToast() {
  const { toast } = useToast();

  return {
    success: (title: string, description?: string) =>
      toast({ title, description }),

    error: (err: unknown, fallbackTitle = "Something went wrong") => {
      const description =
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "Please try again in a moment.";
      toast({ title: fallbackTitle, description, variant: "destructive" });
    },

    info: (title: string, description?: string) =>
      toast({ title, description }),
  };
}
