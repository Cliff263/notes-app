"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { useAuthStore } from "@/store/auth-store";

export type Account = {
  name: string | null;
  email: string;
  createdAt: string;
  hasPassword: boolean;
  noteCount: number;
  eventCount: number;
};

export function useAccount() {
  return useQuery({
    queryKey: queryKeys.account.detail(),
    queryFn: () => api<Account>("/api/account"),
  });
}

export function useUpdateAccount() {
  const client = useQueryClient();
  const { update } = useSession();

  return useMutation({
    mutationFn: (name: string) =>
      api<{ ok: true; name: string }>("/api/account", {
        method: "PATCH",
        body: JSON.stringify({ name }),
      }),
    async onMutate(name) {
      await client.cancelQueries({ queryKey: queryKeys.account.detail() });
      const previous = client.getQueryData<Account>(queryKeys.account.detail());
      client.setQueryData<Account>(queryKeys.account.detail(), (current) =>
        current ? { ...current, name } : current,
      );
      useAuthStore.getState().setUserName(name);
      return { previous };
    },
    onError: (_error, _name, context) => {
      if (context?.previous) {
        client.setQueryData(queryKeys.account.detail(), context.previous);
        useAuthStore.getState().setUserName(context.previous.name ?? "");
      }
    },
    onSuccess: async (_result, name) => {
      await update({ user: { name } });
    },
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: () => api("/api/account", { method: "DELETE" }),
  });
}
