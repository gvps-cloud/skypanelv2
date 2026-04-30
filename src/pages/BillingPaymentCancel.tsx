import React from 'react';
import { useNavigate } from 'react-router-dom';
import { XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const BillingPaymentCancel: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="max-w-lg w-full">
        <CardContent className="p-8 text-center">
          <div className="flex justify-center mb-4">
            <XCircle className="h-12 w-12 text-yellow-500" />
          </div>
          <h1 className="text-2xl font-semibold mb-3">Payment Cancelled</h1>
          <p className="text-muted-foreground mb-6">
            The PayPal payment was cancelled. Your wallet balance has not changed. You can restart the process whenever you are ready.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button onClick={() => navigate('/billing')}>
              Back to Billing
            </Button>
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BillingPaymentCancel;
