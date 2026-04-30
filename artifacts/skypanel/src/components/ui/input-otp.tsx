import * as React from 'react';
import { Minus } from 'lucide-react';
import { OTPInput, OTPInputContext } from 'input-otp';

import { cn } from '@/lib/utils';

type InputOTPProps = React.ComponentPropsWithoutRef<typeof OTPInput> & {
  containerClassName?: string;
};

type InputOTPSlotProps = React.ComponentPropsWithoutRef<'div'> & {
  index: number;
};

const InputOTP = React.forwardRef<React.ElementRef<typeof OTPInput>, InputOTPProps>(
  ({ className, containerClassName, ...props }, ref) => {
    return (
      <OTPInput
        ref={ref}
        containerClassName={cn('flex items-center gap-2 has-disabled:opacity-50', containerClassName)}
        className={cn('disabled:cursor-not-allowed', className)}
        {...props}
      />
    );
  }
);
InputOTP.displayName = 'InputOTP';

const InputOTPGroup = React.forwardRef<React.ElementRef<'div'>, React.ComponentPropsWithoutRef<'div'>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center gap-2', className)} {...props} />
  )
);
InputOTPGroup.displayName = 'InputOTPGroup';

const InputOTPSlot = React.forwardRef<React.ElementRef<'div'>, InputOTPSlotProps>(
  ({ index, className, ...props }, ref) => {
    const inputOTPContext = React.useContext(OTPInputContext) as
      | {
          slots: Array<{ char: string; hasFakeCaret: boolean; isActive: boolean }>;
        }
      | null;
    const slot = inputOTPContext?.slots[index];
    const char = slot?.char ?? '';
    const hasFakeCaret = slot?.hasFakeCaret;
    const isActive = slot?.isActive;

    return (
      <div
        ref={ref}
        data-slot="input-otp-slot"
        data-active={isActive}
        className={cn(
          'border-input relative flex h-11 w-10 items-center justify-center border-y border-r text-lg font-semibold uppercase shadow-sm transition-all first:rounded-l-md first:border-l last:rounded-r-md',
          'data-[active=true]:z-10 data-[active=true]:border-ring data-[active=true]:ring-[3px] data-[active=true]:ring-ring/50',
          'aria-invalid:border-destructive data-[active=true]:aria-invalid:border-destructive data-[active=true]:aria-invalid:ring-destructive/30',
          className
        )}
        {...props}
      >
        {char}
        {hasFakeCaret ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-4 w-px animate-pulse bg-foreground" />
          </div>
        ) : null}
      </div>
    );
  }
);
InputOTPSlot.displayName = 'InputOTPSlot';

const InputOTPSeparator = React.forwardRef<React.ElementRef<'div'>, React.ComponentPropsWithoutRef<'div'>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center justify-center px-1 text-muted-foreground', className)}
      {...props}
    >
      <Minus className="h-4 w-4" />
    </div>
  )
);
InputOTPSeparator.displayName = 'InputOTPSeparator';

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator };
