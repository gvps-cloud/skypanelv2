import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { motion } from "framer-motion";

import "@/styles/auth.css";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await login(email, password, show2FA ? twoFactorCode : undefined);

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
    <div className="auth-page">
      <div className="auth-page__grid" />
      <div className="auth-page__orb-left" />
      <div className="auth-page__orb-right" />
      <div className="auth-page__orb-bottom" />

      <motion.div
        className="auth-content"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <Link to="/" className="auth-back-link">
          ← Back to home
        </Link>

        <div className="auth-card">
          <div className="auth-card__header">
            <div className="auth-card__icon-wrap">
              <LogIn className="h-5 w-5" />
            </div>
            <h1 className="auth-card__title">Welcome back</h1>
            <p className="auth-card__subtitle">
              Sign in to your {BRAND_NAME} account
            </p>
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

            <div className="auth-footer">
              Don&apos;t have an account?{" "}
              <Link to="/register" className="auth-footer__link">
                Sign up
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
