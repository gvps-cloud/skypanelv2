import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, Eye, EyeOff, KeyRound } from "lucide-react";
import { motion } from "framer-motion";

import "@/styles/auth.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";

const RESET_CODE_LENGTH = 8;

export default function ResetPassword() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);

  const otpGroups = useMemo(() => {
    const slots = Array.from({ length: RESET_CODE_LENGTH }, (_, index) => (
      <InputOTPSlot key={index} index={index} />
    ));
    const midpoint = Math.floor(slots.length / 2);
    return [
      <InputOTPGroup key="group-1">{slots.slice(0, midpoint)}</InputOTPGroup>,
      <InputOTPGroup key="group-2">{slots.slice(midpoint)}</InputOTPGroup>,
    ];
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }

    if (resetCode.length !== RESET_CODE_LENGTH) {
      toast.error("Please enter the full reset code.");
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token: resetCode, password }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message = data?.error || "Failed to reset password";
        throw new Error(message);
      }

      toast.success("Password reset successfully. You can now sign in.");
      setCompleted(true);
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setResetCode("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to reset password";
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
              <KeyRound className="h-5 w-5" />
            </div>
            <h1 className="auth-card__title">Set a new password</h1>
            <p className="auth-card__subtitle">
              {completed
                ? "Your password has been updated successfully."
                : "Enter your email and the 8-digit reset code from your inbox."}
            </p>
          </div>

          <div className="auth-card__body">
            {completed ? (
              <div className="auth-success">
                <div className="auth-success__icon">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <p className="auth-success__title">All done!</p>
                <p className="auth-success__desc">
                  You can now sign in with your new password.
                </p>
                <Button
                  className="auth-submit-btn w-full"
                  onClick={() => navigate("/login")}
                >
                  Go to sign in
                </Button>
              </div>
            ) : (
              <form className="auth-form" onSubmit={handleSubmit}>
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
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter the email where you received the reset code.
                  </p>
                </div>

                <div className="auth-form__group">
                  <Label htmlFor="reset-code" className="auth-form__label">
                    Reset code
                  </Label>
                  <div className="auth-otp-wrap">
                    <InputOTP
                      id="reset-code"
                      maxLength={RESET_CODE_LENGTH}
                      value={resetCode}
                      onChange={(value) => {
                        const sanitized = value.replace(/\D/g, "");
                        setResetCode(sanitized.slice(0, RESET_CODE_LENGTH));
                      }}
                    >
                      {otpGroups[0]}
                      <InputOTPSeparator />
                      {otpGroups[1]}
                    </InputOTP>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    The code expires in one hour. Paste is supported.
                  </p>
                </div>

                <div className="auth-form__group">
                  <Label htmlFor="password" className="auth-form__label">
                    New password
                  </Label>
                  <div className="auth-form__input-wrap">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      autoComplete="new-password"
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="At least 8 characters"
                      required
                      className="auth-input"
                    />
                    <button
                      type="button"
                      className="auth-form__password-toggle"
                      onClick={() => setShowPassword((prev) => !prev)}
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

                <div className="auth-form__group">
                  <Label htmlFor="confirm-password" className="auth-form__label">
                    Confirm password
                  </Label>
                  <div className="auth-form__input-wrap">
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      autoComplete="new-password"
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Re-enter your password"
                      required
                      className="auth-input"
                    />
                    <button
                      type="button"
                      className="auth-form__password-toggle"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="auth-submit-btn"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                      Updating password…
                    </span>
                  ) : (
                    "Update password"
                  )}
                </Button>
              </form>
            )}

            {!completed && (
              <div className="auth-footer">
                Remembered your password?{" "}
                <Link to="/login" className="auth-footer__link">
                  Sign in
                </Link>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
