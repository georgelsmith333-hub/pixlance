import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface User {
  id: number;
  email: string;
  name: string;
  plan: string;
  monthlyUsage?: number;
}

interface AuthMe {
  user: User | null;
}

export function useAuth() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<AuthMe>({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      return res.json() as Promise<AuthMe>;
    },
    staleTime: 60_000,
    retry: false,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    },
    onSuccess: () => {
      queryClient.setQueryData(["auth", "me"], { user: null });
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });

  return {
    user: data?.user ?? null,
    isLoading,
    isLoggedIn: !!data?.user,
    logout: () => logoutMutation.mutate(),
  };
}

export function useUsage() {
  return useQuery({
    queryKey: ["auth", "usage"],
    queryFn: async () => {
      const res = await fetch("/api/auth/usage", { credentials: "include" });
      return res.json() as Promise<{ usage: number; limit: number; plan: string }>;
    },
    staleTime: 30_000,
    retry: false,
  });
}
