import React, { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, Mail } from "lucide-react";
import { motion } from "framer-motion";

import "@/styles/auth.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error("Failed to process password reset request");
      }

      await response.json();
      toast.success("Reset code has been sent to your email");
      setSubmitted(true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "An error occurred";
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
              <Mail className="h-5 w-5" />
            </div>
            <h1 className="auth-card__title">Reset your password</h1>
            <p className="auth-card__subtitle">
              {submitted
                ? "Check your email for the reset code and instructions"
                : "Enter your email address and we'll send you a reset code."}
            </p>
          </div>

          <div className="auth-card__body">
            {!submitted ? (
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
                </div>

                <Button
                  type="submit"
                  className="auth-submit-btn"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                      Sending reset link…
                    </span>
                  ) : (
                    "Send reset link"
                  )}
                </Button>
              </form>
            ) : (
              <div className="auth-success">
                <div className="auth-success__icon">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <p className="auth-success__desc">
                  We&apos;ve sent an 8-digit reset code to{" "}
                  <strong>{email}</strong>. Please check your inbox (and spam folder). The code
                  expires in one hour.
                </p>
                <Link to="/reset-password" className="w-full">
                  <Button className="auth-submit-btn w-full">
                    Go to reset password page
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setSubmitted(false);
                    setEmail("");
                  }}
                >
                  Try another email
                </Button>
              </div>
            )}

            <div className="auth-footer">
              Remember your password?{" "}
              <Link to="/login" className="auth-footer__link">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
