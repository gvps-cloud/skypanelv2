import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { paymentService } from '../services/paymentService';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const BillingPaymentSuccess: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Capturing your PayPal payment...');
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('token');

    if (!orderId) {
      setStatus('error');
      setMessage('Missing PayPal order token.');
      return;
    }

    const capturePayment = async () => {
      setIsCapturing(true);
      try {
        const result = await paymentService.capturePayment(orderId);

        if (result.success) {
          setStatus('success');
          setMessage('Payment captured successfully. Your wallet will reflect the funds shortly.');
        } else {
          setStatus('error');
          setMessage(result.error || 'Failed to capture PayPal payment.');
        }
      } catch (error) {
        console.error('PayPal capture error:', error);
        setStatus('error');
        setMessage('Failed to capture PayPal payment.');
      } finally {
        setIsCapturing(false);
      }
    };

    capturePayment();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="max-w-lg w-full">
        <CardContent className="p-8 text-center">
          <div className="flex justify-center mb-4">
            {status === 'processing' && <Loader2 className="h-12 w-12 text-foreground animate-spin" />}
            {status === 'success' && <CheckCircle className="h-12 w-12 text-green-500" />}
            {status === 'error' && <XCircle className="h-12 w-12 text-destructive" />}
          </div>
          <h1 className="text-2xl font-semibold mb-3">
            {status === 'processing' && 'Completing Payment'}
            {status === 'success' && 'Payment Successful'}
            {status === 'error' && 'Payment Issue'}
          </h1>
          <p className="text-muted-foreground mb-6">{message}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button onClick={() => navigate('/billing')}>
              Back to Billing
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate('/dashboard')}
              disabled={isCapturing && status === 'processing'}
            >
              Go to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BillingPaymentSuccess;
