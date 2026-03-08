import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle, XCircle, Building2, Mail, Clock, AlertCircle, LogIn, UserPlus, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { BRAND_NAME } from "@/lib/brand";

interface InvitationDetails {
  id: string;
  organization_id: string;
  organization_name: string;
  invited_email: string;
  role_id: string;
  role_name: string;
  inviter_id: string;
  inviter_name: string;
  inviter_email: string;
  token: string;
  status: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

type InvitationState = "loading" | "valid" | "success" | "error";
type ErrorType = "invalid" | "expired" | "already_accepted" | "already_declined" | "generic";

export default function AcceptInvitation() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, login, switchOrganization } = useAuth();

  const [invitationState, setInvitationState] = useState<InvitationState>("loading");
  const [errorType, setErrorType] = useState<ErrorType>("generic");
  const [invitationData, setInvitationData] = useState<InvitationDetails | null>(null);
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [showSignupForm, setShowSignupForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoDecline, setAutoDecline] = useState(false);
  const [hasAttemptedAccept, setHasAttemptedAccept] = useState(false);

  // Check if the URL contains /accept or /decline path segments
  const currentPath = window.location.pathname;
  const isLegacyAcceptUrl = currentPath.endsWith('/accept');
  const isLegacyDeclineUrl = currentPath.endsWith('/decline');

  // Get the current URL for redirect after login
  const getCurrentUrl = () => {
    return window.location.pathname + window.location.search;
  };

  const { isLoading: isValidating, error: validationError } = useQuery({
    queryKey: ["invitation", token],
    queryFn: async () => {
      const response = await apiClient.get<{ error?: string } & InvitationDetails>(
        `/organizations/invitations/${token}`
      );
      return response;
    },
    enabled: !!token && !showLoginForm && !showSignupForm,
    retry: false,
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<{ message: string; organization_id?: string }>(
        `/organizations/invitations/${token}/accept`
      );
      return response;
    },
    onSuccess: async (data) => {
      if (data.organization_id) {
        await switchOrganization(data.organization_id);
      }
      setInvitationState("success");
      toast.success("You have successfully joined the organization!");

      setTimeout(() => {
        navigate("/dashboard");
      }, 3000);
    },
    onError: (error: any) => {
      // Don't set state to error immediately, let the user try manually
      // This prevents the infinite loop while still allowing manual retry
      toast.error(error.message || "Failed to accept invitation. Please try again.");
      setHasAttemptedAccept(false); // Reset to allow manual retry
    }
  });

  const declineMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<{ message: string }>(
        `/organizations/invitations/${token}/decline`
      );
      return response;
    },
    onSuccess: () => {
      setInvitationState("success");
      toast.success("Invitation declined successfully");

      setTimeout(() => {
        navigate("/dashboard");
      }, 3000);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to decline invitation. Please try again.");
      setAutoDecline(false); // Reset to allow manual retry
    }
  });

  useEffect(() => {
    if (!validationError && isValidating === false) {
      const data = queryClient.getQueryData(["invitation", token]) as { error?: string } & InvitationDetails;
      if (data && !data.error) {
        setInvitationData(data);
        setInvitationState("valid");
        setEmail(data.invited_email);
      } else if (data?.error) {
        setInvitationState("error");
        // Determine error type based on error message
        const errorMsg = data.error.toLowerCase();
        if (errorMsg.includes('expired')) {
          setErrorType("expired");
        } else if (errorMsg.includes('accepted')) {
          setErrorType("already_accepted");
        } else if (errorMsg.includes('declined')) {
          setErrorType("already_declined");
        } else if (errorMsg.includes('invalid')) {
          setErrorType("invalid");
        } else {
          setErrorType("generic");
        }
      }
    } else if (validationError) {
      setInvitationState("error");
      setErrorType("generic");
    }
  }, [isValidating, validationError, token, queryClient]);

  // Check for decline action in URL params or legacy URL pattern
  useEffect(() => {
    const action = searchParams.get('action');
    const shouldDecline = action === 'decline' || isLegacyDeclineUrl;

    if (shouldDecline && invitationState === 'valid' && invitationData && !declineMutation.isPending) {
      setAutoDecline(true);
      declineMutation.mutate();
    }
  }, [searchParams, invitationState, invitationData, declineMutation, isLegacyDeclineUrl]);

  // Store redirect URL in sessionStorage for login flow
  useEffect(() => {
    if (token && !user) {
      sessionStorage.setItem('postLoginRedirect', getCurrentUrl());
    } else if (user && token) {
      // Clean up the redirect storage once user is logged in
      sessionStorage.removeItem('postLoginRedirect');
    }
  }, [token, user]);

  // Auto-accept or show UI when user logs in and email matches
  useEffect(() => {
    // Only proceed if we have all required data and haven't attempted yet
    const shouldAutoAccept =
      user &&
      invitationState === 'valid' &&
      invitationData &&
      !autoDecline &&
      !hasAttemptedAccept &&
      !acceptMutation.isPending &&
      !declineMutation.isPending;

    if (shouldAutoAccept) {
      const emailMatches = user?.email?.toLowerCase() === invitationData.invited_email.toLowerCase();
      if (emailMatches) {
        // Auto-accept the invitation when user logs in with matching email
        setHasAttemptedAccept(true);
        acceptMutation.mutate();
      }
    }
  }, [user, invitationState, invitationData, autoDecline, hasAttemptedAccept, acceptMutation, declineMutation]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await login(email, password);
      setShowLoginForm(false);
      toast.success("Logged in successfully!");
      // The redirect will be handled by the useEffect that checks user state
    } catch (error: any) {
      toast.error(error.message || "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  };

  const getErrorContent = () => {
    switch (errorType) {
      case "invalid":
        return {
          title: "Invalid Invitation",
          description: "This invitation link is not valid. It may have been cancelled or the link is incorrect.",
          icon: <XCircle className="h-12 w-12 text-destructive" />
        };
      case "expired":
        return {
          title: "Invitation Expired",
          description: "This invitation has expired. Please ask the organization owner to send you a new invitation.",
          icon: <Clock className="h-12 w-12 text-destructive" />
        };
      case "already_accepted":
        return {
          title: "Already Accepted",
          description: "You have already accepted this invitation and are now a member of this organization.",
          icon: <CheckCircle className="h-12 w-12 text-primary" />
        };
      case "already_declined":
        return {
          title: "Invitation Declined",
          description: "You have already declined this invitation. If you want to join, please ask for a new invitation.",
          icon: <XCircle className="h-12 w-12 text-muted-foreground" />
        };
      default:
        return {
          title: "Unable to Process Invitation",
          description: "We encountered an error while processing your invitation. Please try again or contact support.",
          icon: <AlertCircle className="h-12 w-12 text-destructive" />
        };
    }
  };

  if (showLoginForm) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/40 px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-4 text-sm">
            <Button
              variant="ghost"
              onClick={() => setShowLoginForm(false)}
              className="text-muted-foreground hover:text-primary/80"
            >
              ← Back to invitation
            </Button>
          </div>
          <Card className="shadow-lg">
            <CardHeader className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <LogIn className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <CardTitle className="text-3xl font-semibold">Sign in to accept</CardTitle>
                <CardDescription>
                  Sign in to {BRAND_NAME} to accept your invitation to join {invitationData?.organization_name || "the organization"}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <form className="space-y-6" onSubmit={handleLogin}>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label htmlFor="email">Email address</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      placeholder="Enter your email"
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      placeholder="Enter your password"
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                      Signing in…
                    </span>
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{" "}
                <Button
                  variant="link"
                  className="font-medium text-primary hover:text-primary/80 p-0"
                  onClick={() => {
                    setShowLoginForm(false);
                    setShowSignupForm(true);
                  }}
                >
                  Sign up
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (showSignupForm) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/40 px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-4 text-sm">
            <Button
              variant="ghost"
              onClick={() => setShowSignupForm(false)}
              className="text-muted-foreground hover:text-primary/80"
            >
              ← Back to invitation
            </Button>
          </div>
          <Card className="shadow-lg">
            <CardHeader className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <UserPlus className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <CardTitle className="text-3xl font-semibold">Create an account</CardTitle>
                <CardDescription>
                  Sign up for {BRAND_NAME} to accept your invitation to join {invitationData?.organization_name || "the organization"}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label htmlFor="signup-email">Email address</Label>
                    <Input
                      id="signup-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      placeholder="Enter your email"
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Your email must match the invitation email: {invitationData?.invited_email}
                    </p>
                  </div>
                </div>

                <Button
                  className="w-full"
                  onClick={() => {
                    sessionStorage.setItem('postLoginRedirect', getCurrentUrl());
                    navigate("/register", { state: { email, invitationToken: token } });
                  }}
                >
                  Continue to sign up
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>

              <div className="mt-6 text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Button
                  variant="link"
                  className="font-medium text-primary hover:text-primary/80 p-0"
                  onClick={() => {
                    setShowSignupForm(false);
                    setShowLoginForm(true);
                  }}
                >
                  Sign in
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (invitationState === "loading" || isValidating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/40">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Validating invitation...</p>
        </div>
      </div>
    );
  }

  if (invitationState === "error") {
    const errorContent = getErrorContent();
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/40 px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-4 text-sm">
            <Link to="/" className="text-muted-foreground hover:text-primary/80">
              ← Back to home
            </Link>
          </div>
          <Card className="shadow-lg">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="mx-auto">{errorContent.icon}</div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold">{errorContent.title}</h2>
                  <p className="text-muted-foreground">{errorContent.description}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <Button asChild className="w-full">
                    <Link to="/dashboard">Go to Dashboard</Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/">Return Home</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (invitationState === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/40 px-4 py-12">
        <div className="w-full max-w-md">
          <Card className="shadow-lg">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                  <CheckCircle className="h-10 w-10 text-primary" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold">Welcome to the team!</h2>
                  <p className="text-muted-foreground">
                    You have successfully joined {invitationData?.organization_name || "the organization"}.
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Redirecting you to the dashboard...
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (invitationState === "valid" && invitationData) {
    const isLoggedIn = !!user;
    const emailMatches = user?.email?.toLowerCase() === invitationData.invited_email.toLowerCase();

    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/40 px-4 py-12">
        <div className="w-full max-w-lg">
          <div className="mb-4 text-sm">
            <Link to="/" className="text-muted-foreground hover:text-primary/80">
              ← Back to home
            </Link>
          </div>
          <Card className="shadow-lg">
            <CardHeader className="space-y-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <Building2 className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <CardTitle className="text-3xl font-semibold">You're invited!</CardTitle>
                <CardDescription>
                  Join {invitationData.organization_name} as a {invitationData.role_name}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <Mail className="h-4 w-4" />
                <AlertTitle>Invitation Details</AlertTitle>
                <div className="mt-2 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Organization:</span>
                    <span className="font-medium">{invitationData.organization_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Role:</span>
                    <span className="font-medium">{invitationData.role_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Invited by:</span>
                    <span className="font-medium">
                      {invitationData.inviter_name || invitationData.inviter_email}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expires on:</span>
                    <span className="font-medium">{formatDate(invitationData.expires_at)}</span>
                  </div>
                </div>
              </Alert>

              {!isLoggedIn ? (
                <div className="space-y-3">
                  <p className="text-center text-sm text-muted-foreground">
                    Sign in or create an account to accept this invitation
                  </p>
                  <Button className="w-full" onClick={() => setShowLoginForm(true)}>
                    <LogIn className="mr-2 h-4 w-4" />
                    Sign in to Accept
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => setShowSignupForm(true)}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Create an Account
                  </Button>
                </div>
              ) : !emailMatches ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Email Mismatch</AlertTitle>
                  <AlertDescription>
                    This invitation is for {invitationData.invited_email}, but you are signed in as {user.email}.
                    Please sign in with the correct email address to accept this invitation.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-3">
                  <div className="text-center text-sm text-muted-foreground">
                    Signed in as <span className="font-medium">{user.email}</span>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => acceptMutation.mutate()}
                    disabled={acceptMutation.isPending}
                  >
                    {acceptMutation.isPending ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                        Accepting...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        Accept Invitation
                      </span>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => declineMutation.mutate()}
                    disabled={declineMutation.isPending}
                  >
                    {declineMutation.isPending ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        Declining...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <XCircle className="h-4 w-4" />
                        Decline Invitation
                      </span>
                    )}
                  </Button>
                </div>
              )}

              <p className="text-center text-xs text-muted-foreground">
                By accepting this invitation, you will become a member of {invitationData.organization_name} and agree to their team policies.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return null;
}
