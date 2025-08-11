import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { User, RegisterUser, LoginUser, ForgotPassword, ResetPassword } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<User, Error, LoginUser>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<{ message: string; requiresVerification: boolean }, Error, RegisterUser>;
  forgotPasswordMutation: UseMutationResult<{ message: string }, Error, ForgotPassword>;
  resetPasswordMutation: UseMutationResult<{ message: string }, Error, ResetPassword>;
  verifyEmailMutation: UseMutationResult<{ message: string }, Error, { token: string }>;
  resendVerificationMutation: UseMutationResult<{ message: string }, Error, { email: string }>;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<User | undefined, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 0, // Force refetch
    refetchOnWindowFocus: true,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginUser) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      return await res.json();
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "Login successful",
        description: "Welcome back!",
      });
    },
    onError: (error: any) => {
      const message = error.message || "Login failed";
      toast({
        title: "Login failed",
        description: message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: RegisterUser) => {
      const res = await apiRequest("POST", "/api/register", credentials);
      return await res.json();
    },
    onSuccess: (response: { message: string; requiresVerification: boolean }) => {
      toast({
        title: "Registration successful",
        description: response.message,
      });
    },
    onError: (error: any) => {
      const message = error.message || "Registration failed";
      toast({
        title: "Registration failed",
        description: message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      toast({
        title: "Logged out",
        description: "You have been logged out successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Logout failed",
        description: error.message || "Failed to logout",
        variant: "destructive",
      });
    },
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: async (data: ForgotPassword) => {
      const res = await apiRequest("POST", "/api/forgot-password", data);
      return await res.json();
    },
    onSuccess: (response: { message: string }) => {
      toast({
        title: "Password reset sent",
        description: response.message,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Password reset failed",
        description: error.message || "Failed to send password reset email",
        variant: "destructive",
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: ResetPassword) => {
      const res = await apiRequest("POST", "/api/reset-password", data);
      return await res.json();
    },
    onSuccess: (response: { message: string }) => {
      toast({
        title: "Password reset successful",
        description: response.message,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Password reset failed",
        description: error.message || "Failed to reset password",
        variant: "destructive",
      });
    },
  });

  const verifyEmailMutation = useMutation({
    mutationFn: async (data: { token: string }) => {
      const res = await apiRequest("POST", "/api/verify-email", data);
      return await res.json();
    },
    onSuccess: (response: { message: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Email verified",
        description: response.message,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Email verification failed",
        description: error.message || "Failed to verify email",
        variant: "destructive",
      });
    },
  });

  const resendVerificationMutation = useMutation({
    mutationFn: async (data: { email: string }) => {
      const res = await apiRequest("POST", "/api/resend-verification", data);
      return await res.json();
    },
    onSuccess: (response: { message: string }) => {
      toast({
        title: "Verification email sent",
        description: response.message,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send verification email",
        description: error.message || "Failed to resend verification email",
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
        forgotPasswordMutation,
        resetPasswordMutation,
        verifyEmailMutation,
        resendVerificationMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}