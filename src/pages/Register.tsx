import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import { motion } from "framer-motion";

import "@/styles/auth.css";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { BRAND_NAME } from "@/lib/brand";

export default function Register() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      setLoading(false);
      return;
    }

    if (formData.password.length < 8) {
      toast.error("Password must be at least 8 characters long");
      setLoading(false);
      return;
    }

    try {
      await register({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
      });
      toast.success(`Registration successful! Welcome to ${BRAND_NAME}!`);
      const redirectUrl = sessionStorage.getItem("postLoginRedirect");
      if (redirectUrl && redirectUrl.startsWith("/") && !redirectUrl.startsWith("//")) {
        sessionStorage.removeItem("postLoginRedirect");
        navigate(redirectUrl);
      } else {
        navigate("/dashboard");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Registration failed";
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
              <UserPlus className="h-5 w-5" />
            </div>
            <h1 className="auth-card__title">Create your account</h1>
            <p className="auth-card__subtitle">
              Join {BRAND_NAME} and start managing your infrastructure
            </p>
          </div>

          <div className="auth-card__body">
            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-3">
                <div className="auth-form__group">
                  <Label htmlFor="firstName" className="auth-form__label">
                    First name
                  </Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={handleChange}
                    placeholder="John"
                    className="auth-input"
                  />
                </div>

                <div className="auth-form__group">
                  <Label htmlFor="lastName" className="auth-form__label">
                    Last name
                  </Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={handleChange}
                    placeholder="Doe"
                    className="auth-input"
                  />
                </div>
              </div>

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
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
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
                    autoComplete="new-password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="At least 8 characters"
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

              <div className="auth-form__group">
                <Label htmlFor="confirmPassword" className="auth-form__label">
                  Confirm password
                </Label>
                <div className="auth-form__input-wrap">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Re-enter your password"
                    className="auth-input"
                  />
                  <button
                    type="button"
                    className="auth-form__password-toggle"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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

              <label className="auth-row__remember">
                <Checkbox
                  id="terms"
                  checked={agreeTerms}
                  onCheckedChange={(checked) => setAgreeTerms(Boolean(checked))}
                  required
                />
                <span className="text-xs text-muted-foreground">
                  I agree to the{" "}
                  <Link to="/terms" className="auth-footer__link">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link to="/privacy" className="auth-footer__link">
                    Privacy Policy
                  </Link>
                </span>
              </label>

              <Button
                type="submit"
                className="auth-submit-btn"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    Creating account…
                  </span>
                ) : (
                  "Create account"
                )}
              </Button>
            </form>

            <div className="auth-footer">
              Already have an account?{" "}
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
