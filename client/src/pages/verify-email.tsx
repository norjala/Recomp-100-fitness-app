import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Mail, AlertCircle, Loader2 } from "lucide-react";

export default function VerifyEmailPage() {
  const { user, verifyEmailMutation, resendVerificationMutation } = useAuth();
  const [, setLocation] = useLocation();
  const [token, setToken] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'success' | 'error'>('pending');

  useEffect(() => {
    // Check if there's a token in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    
    if (tokenParam) {
      setToken(tokenParam);
      // Automatically verify email if token is present
      verifyEmailMutation.mutate({ token: tokenParam }, {
        onSuccess: () => {
          setVerificationStatus('success');
          setTimeout(() => setLocation('/'), 2000);
        },
        onError: () => {
          setVerificationStatus('error');
        }
      });
    }
  }, [verifyEmailMutation, setLocation]);

  useEffect(() => {
    // Redirect if user is already verified
    if (user && user.isEmailVerified) {
      setLocation('/');
    }
  }, [user, setLocation]);

  const handleResendVerification = () => {
    if (user?.email) {
      resendVerificationMutation.mutate({ email: user.email });
    }
  };

  if (!user) {
    setLocation('/auth');
    return null;
  }

  if (user.isEmailVerified) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gray-50">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            {verificationStatus === 'success' && (
              <>
                <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
                <CardTitle>Email Verified!</CardTitle>
                <CardDescription>
                  Your email has been successfully verified. Redirecting you to the app...
                </CardDescription>
              </>
            )}
            {verificationStatus === 'error' && (
              <>
                <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
                <CardTitle>Verification Failed</CardTitle>
                <CardDescription>
                  The verification link is invalid or has expired. Please try requesting a new one.
                </CardDescription>
              </>
            )}
            {verificationStatus === 'pending' && !token && (
              <>
                <Mail className="mx-auto h-12 w-12 text-blue-500 mb-4" />
                <CardTitle>Verify Your Email</CardTitle>
                <CardDescription>
                  Please check your email for a verification link. Click the link to activate your account.
                </CardDescription>
              </>
            )}
            {verificationStatus === 'pending' && token && (
              <>
                <Loader2 className="mx-auto h-12 w-12 text-blue-500 animate-spin mb-4" />
                <CardTitle>Verifying...</CardTitle>
                <CardDescription>
                  Please wait while we verify your email address.
                </CardDescription>
              </>
            )}
          </CardHeader>
          <CardContent>
            {verificationStatus === 'pending' && !token && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  We sent a verification email to <strong>{user.email}</strong>
                </p>
                <Button
                  onClick={handleResendVerification}
                  variant="outline"
                  className="w-full"
                  disabled={resendVerificationMutation.isPending}
                >
                  {resendVerificationMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Resend Verification Email
                </Button>
                {process.env.NODE_ENV === "development" && (
                  <Button
                    onClick={() => verifyEmailMutation.mutate({ token: "dev-bypass" })}
                    className="w-full"
                    disabled={verifyEmailMutation.isPending}
                  >
                    {verifyEmailMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Manual Verify (Dev Mode)
                  </Button>
                )}
                <Button
                  onClick={() => setLocation('/auth')}
                  variant="ghost"
                  className="w-full"
                >
                  Back to Login
                </Button>
              </div>
            )}
            {verificationStatus === 'error' && (
              <div className="space-y-4">
                <Button
                  onClick={handleResendVerification}
                  className="w-full"
                  disabled={resendVerificationMutation.isPending}
                >
                  {resendVerificationMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Request New Verification Email
                </Button>
                <Button
                  onClick={() => setLocation('/auth')}
                  variant="outline"
                  className="w-full"
                >
                  Back to Login
                </Button>
              </div>
            )}
            {verificationStatus === 'success' && (
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Taking you to FitnessForge...
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}