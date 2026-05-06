import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Eye, EyeOff, LogIn, AlertTriangle } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import "@/styles/auth.css";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DataStreamCanvas from "@/components/home/DataStreamCanvas";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteStatus } from "@/hooks/useSiteStatus";
import { BRAND_NAME } from "@/lib/brand";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [show2FA, setShow2FA] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const [searchParams] = useSearchParams();
  const { data: siteStatus } = useSiteStatus();

  // Reconstruct code from search + hash because # in the code is parsed as URL fragment
  const url = new URL(window.location.href);
  const codeFromSearch = url.searchParams.get("code") || "";
  const codeFromHash = url.hash ? url.hash.slice(1) : "";
  const maintenanceCode = codeFromSearch
    ? codeFromSearch + (codeFromHash ? "#" + codeFromHash : "")
    : undefined;
  const isMaintenance = siteStatus?.maintenanceMode === true;
  const isRegDisabled = siteStatus?.registrationDisabled === true;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await login(
        email,
        password,
        show2FA ? twoFactorCode : undefined,
        maintenanceCode
      );

      if (result && result.require2fa) {
        setShow2FA(true);
        setLoading(false);
        toast.info("Please enter your 2FA code");
        return;
      }

      toast.success("Login successful!");
      const redirectUrl = sessionStorage.getItem('postLoginRedirect');
      if (redirectUrl && redirectUrl.startsWith('/') && !redirectUrl.startsWith('//')) {
        sessionStorage.removeItem('postLoginRedirect');
        navigate(redirectUrl);
      } else {
        navigate("/dashboard");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Login failed";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page auth-page--split">
      <div className="auth-page__grid" />
      <div className="auth-page__orb-left" />
      <div className="auth-page__orb-right" />
      <div className="auth-page__orb-bottom" />

      <motion.div
        className="auth-split"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div className="auth-split__form">
          <Link to="/" className="auth-brand-link" aria-label={`${BRAND_NAME} home`}>
            <span className="auth-brand-link__mark">
              <Logo size="sm" />
            </span>
            <span>{BRAND_NAME}</span>
          </Link>

          <div className="auth-card">
            <div className="auth-card__header">
              <div className="auth-card__icon-wrap">
                <LogIn className="h-5 w-5" />
              </div>
              <h1 className="auth-card__title">Login to your account</h1>
              <p className="auth-card__subtitle">
                Enter your email below to login to your account
              </p>
              {isMaintenance && (
                <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Site is under maintenance. Admin access only.</span>
                </div>
              )}
              {isRegDisabled && !isMaintenance && (
                <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-600">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>New registrations are currently disabled.</span>
                </div>
              )}
            </div>

            <div className="auth-card__body">
              <form className="auth-form" onSubmit={handleSubmit}>
                {show2FA ? (
                  <>
                    <div className="auth-form__group">
                      <Label htmlFor="2fa-code" className="auth-form__label">
                        Two-Factor Authentication Code
                      </Label>
                      <Input
                        id="2fa-code"
                        name="code"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        required={show2FA}
                        value={twoFactorCode}
                        placeholder="Enter 6-digit code"
                        onChange={(e) => setTwoFactorCode(e.target.value)}
                        className="auth-input"
                        autoFocus
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Enter the code from your authenticator app.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="auth-form__group">
                      <Label htmlFor="email" className="auth-form__label">
                        Email address
                      </Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        placeholder="you@example.com"
                        onChange={(e) => setEmail(e.target.value)}
                        className="auth-input"
                      />
                    </div>

                    <div className="auth-form__group">
                      <Label htmlFor="password" className="auth-form__label">
                        Password
                      </Label>
                      <div className="auth-form__input-wrap">
                        <Input
                          id="password"
                          name="password"
                          type={showPassword ? "text" : "password"}
                          autoComplete="current-password"
                          required
                          value={password}
                          placeholder="Your password"
                          onChange={(e) => setPassword(e.target.value)}
                          className="auth-input"
                        />
                        <button
                          type="button"
                          className="auth-form__password-toggle"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {!show2FA && (
                  <div className="auth-row">
                    <label className="auth-row__remember">
                      <Checkbox
                        id="remember-me"
                        checked={rememberMe}
                        onCheckedChange={(checked) => setRememberMe(Boolean(checked))}
                      />
                      Remember me
                    </label>
                    <Link to="/forgot-password" className="auth-row__forgot">
                      Forgot password?
                    </Link>
                  </div>
                )}

                <Button
                  type="submit"
                  className="auth-submit-btn"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                      Signing in…
                    </span>
                  ) : show2FA ? (
                    "Verify code"
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </form>

              {!isMaintenance && !isRegDisabled && (
                <div className="auth-footer">
                  Don&apos;t have an account?{" "}
                  <Link to="/register" className="auth-footer__link">
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="auth-split__visual" aria-hidden="true">
          <DataStreamCanvas className="absolute inset-0" reducedMotion={Boolean(prefersReducedMotion)} />
          <div className="auth-split__visual-fade" />
        </div>
      </motion.div>
    </div>
  );
}
