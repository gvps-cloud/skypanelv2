import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Eye, EyeOff, KeyRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from '@/components/ui/input-otp';

const RESET_CODE_LENGTH = 8;

export default function ResetPassword() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
      <InputOTPGroup key="group-2">{slots.slice(midpoint)}</InputOTPGroup>
    ];
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address.');
      return;
    }

    if (resetCode.length !== RESET_CODE_LENGTH) {
      toast.error('Please enter the full reset code.');
      return;
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token: resetCode, password })
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message = data?.error || 'Failed to reset password';
        throw new Error(message);
      }

      toast.success('Password reset successfully. You can now sign in.');
      setCompleted(true);
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setResetCode('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reset password';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/40 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-4 text-sm">
          <Link to="/" className="text-muted-foreground hover:text-primary/80">
            ← Back to home
          </Link>
        </div>
        <Card className="shadow-lg">
          <CardHeader className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <KeyRound className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-3xl font-semibold">Set a new password</CardTitle>
              <CardDescription>
                {completed
                  ? 'Your password has been updated successfully.'
                  : 'Enter your email address, the 8-digit reset code from your email, and choose a new password.'}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {completed ? (
              <div className="space-y-6 text-center">
                <p className="text-sm text-muted-foreground">
                  You can now sign in with your new password.
                </p>
                <Button className="w-full" onClick={() => navigate('/login')}>
                  Go to sign in
                </Button>
              </div>
            ) : (
              <form className="space-y-6" onSubmit={handleSubmit}>
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
                      placeholder="Enter your email address"
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter the email where you received the reset code.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reset-code">Reset code</Label>
                    <InputOTP
                      id="reset-code"
                      maxLength={RESET_CODE_LENGTH}
                      value={resetCode}
                      onChange={(value) => {
                        // Keep the client-side input aligned with the server's 8-digit code format.
                        const sanitized = value.replace(/\D/g, '');
                        setResetCode(sanitized.slice(0, RESET_CODE_LENGTH));
                      }}
                    >
                      {otpGroups[0]}
                      <InputOTPSeparator />
                      {otpGroups[1]}
                    </InputOTP>
                    <p className="text-xs text-muted-foreground">
                      The code expires in one hour. Paste is supported.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="password">New password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        autoComplete="new-password"
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Enter a strong password"
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground"
                        onClick={() => setShowPassword((prev) => !prev)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="confirm-password">Confirm password</Label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        autoComplete="new-password"
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        placeholder="Re-enter your password"
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                      Updating password…
                    </span>
                  ) : (
                    'Update password'
                  )}
                </Button>
              </form>
            )}

            {!completed && (
              <div className="mt-6 text-center text-sm text-muted-foreground">
                Remembered your password?{' '}
                <Link to="/login" className="font-medium text-primary hover:text-primary/80">
                  Sign in
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
