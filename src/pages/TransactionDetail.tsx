import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Download, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { paymentService, type PaymentTransactionDetail } from '../services/paymentService';
import { formatCurrency as formatCurrencyDisplay } from '@/lib/formatters';

const TransactionDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const fromPath = (typeof location.state?.from === 'string' && location.state.from.startsWith('/') && !location.state.from.startsWith('//'))
    ? location.state.from
    : '/billing';
  const fromLabel = location.state?.fromLabel || 'Back to Billing';
  const { token } = useAuth();
  const [transaction, setTransaction] = useState<PaymentTransactionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('Missing transaction ID.');
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fetchTransaction = async () => {
      try {
        const result = await paymentService.getTransactionById(id);
        if (!isMounted) {
          return;
        }

        if (result.success && result.transaction) {
          setTransaction(result.transaction);
          setError(null);
        } else {
          setError(result.error || 'Failed to load transaction details.');
        }
      } catch (err) {
        console.error('Load transaction detail error:', err);
        if (isMounted) {
          setError('Failed to load transaction details.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchTransaction();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const formatCurrencyValue = (
    amount: number | null | undefined,
    currency: string = 'USD'
  ): string => formatCurrencyDisplay(amount, { currency });

  const formatDate = (value: string): string => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleDownloadInvoice = async () => {
    if (!transaction) {
      return;
    }

    if (!token) {
      toast.error('You must be logged in to download invoices.');
      return;
    }

    setInvoiceLoading(true);
    try {
      const result = await paymentService.createInvoiceFromTransaction(transaction.id);
      if (!result.success || !result.invoiceId) {
        toast.error(result.error || 'Failed to generate invoice.');
        return;
      }

      const apiBase = import.meta.env.VITE_API_URL || '/api';
      const downloadUrl = `${apiBase}/invoices/${result.invoiceId}/download`;
      const response = await fetch(downloadUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        try {
          const errorData = await response.json();
          toast.error(errorData.error || 'Failed to download invoice.');
        } catch (payloadError) {
          console.error('Failed to parse invoice error payload:', payloadError);
          toast.error('Failed to download invoice.');
        }
        return;
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('content-disposition');
      // Sanitize filename to prevent XSS
      const sanitizeFilename = (name: string) => name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
      let filename = `invoice-${result.invoiceNumber || result.invoiceId}.pdf`;
      const filenameMatch = contentDisposition?.match(/filename\*?=(?:UTF-8''|"?)([^";\n]+)/i);

      if (filenameMatch && filenameMatch[1]) {
        try {
          filename = sanitizeFilename(decodeURIComponent(filenameMatch[1].replace(/"/g, '')));
        } catch (filenameError) {
          console.warn('Failed to decode invoice filename:', filenameError);
        }
      }

      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);

      toast.success(`Invoice ${result.invoiceNumber || result.invoiceId} downloaded.`);
    } catch (err) {
      console.error('Download invoice error:', err);
      toast.error('Failed to generate invoice.');
    } finally {
      setInvoiceLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center text-muted-foreground ">
          <Loader2 className="h-8 w-8 animate-spin mb-4" />
          <p>Loading transaction details...</p>
        </div>
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-card border border rounded-lg p-6 w-full max-w-md text-center">
          <div className="flex justify-center mb-3">
            <AlertCircle className="h-10 w-10 text-red-500" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Transaction Not Available</h2>
          <p className="text-muted-foreground mb-6">{error || 'We could not find the requested transaction.'}</p>
          <button
            onClick={() => navigate(fromPath)}
            className="inline-flex items-center px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {fromLabel}
          </button>
        </div>
      </div>
    );
  }

  const metadataEntries = transaction.metadata ? Object.entries(transaction.metadata) : [];
  const filteredMetadataEntries = metadataEntries.filter(([key]) => {
    const normalizedKey = key.replace(/[\s_-]/g, '').toLowerCase();
    return normalizedKey !== 'balancebefore' && normalizedKey !== 'balanceafter';
  });
  const supplementalDetails = [
    {
      key: 'balance-before',
      label: 'Balance Before',
      value: transaction.balanceBefore !== null && transaction.balanceBefore !== undefined
        ? formatCurrencyValue(transaction.balanceBefore, transaction.currency)
        : 'N/A',
    },
    {
      key: 'balance-after',
      label: 'Balance After',
      value: transaction.balanceAfter !== null && transaction.balanceAfter !== undefined
        ? formatCurrencyValue(transaction.balanceAfter, transaction.currency)
        : 'N/A',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate(fromPath)}
            className="inline-flex items-center px-3 py-2 rounded-md border border bg-card text-sm font-medium text-muted-foreground hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {fromLabel}
          </button>
          <button
            onClick={handleDownloadInvoice}
            disabled={invoiceLoading}
            className="inline-flex items-center px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
          >
            {invoiceLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Download Invoice
          </button>
        </div>

        <div className="bg-card border border rounded-lg shadow-sm p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Transaction Details</h1>
              <p className="text-muted-foreground mt-1">Review the transaction information and generate an invoice for your records.</p>
            </div>
            <span
              className={`mt-4 md:mt-0 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${transaction.status === 'completed'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                  : transaction.status === 'cancelled' || transaction.status === 'refunded'
                    ? 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                }`}
            >
              {transaction.status.toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Summary</h2>
              <div className="space-y-2 text-muted-foreground">
                <p><span className="font-medium">Description:</span> {transaction.description}</p>
                <p><span className="font-medium">Amount:</span> {formatCurrencyValue(Math.abs(transaction.amount), transaction.currency)} {transaction.type === 'credit' ? '(Credit)' : '(Debit)'}</p>
                <p><span className="font-medium">Balance Before:</span> {transaction.balanceBefore !== null && transaction.balanceBefore !== undefined ? formatCurrencyValue(transaction.balanceBefore, transaction.currency) : 'N/A'}</p>
                <p><span className="font-medium">Balance After:</span> {transaction.balanceAfter !== null && transaction.balanceAfter !== undefined ? formatCurrencyValue(transaction.balanceAfter, transaction.currency) : 'N/A'}</p>
                <p><span className="font-medium">Created At:</span> {formatDate(transaction.createdAt)}</p>
                <p><span className="font-medium">Updated At:</span> {formatDate(transaction.updatedAt)}</p>
              </div>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Payment Source</h2>
              <div className="space-y-2 text-muted-foreground">
                <p><span className="font-medium">Provider:</span> {transaction.provider || 'Internal'}</p>
                <p><span className="font-medium">Method:</span> {transaction.paymentMethod}</p>
                <p><span className="font-medium">Provider Reference:</span> {transaction.providerPaymentId || 'N/A'}</p>
                <p><span className="font-medium">Transaction ID:</span> {transaction.id}</p>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Additional Details</h2>
            <div className="bg-background/40 border border rounded-md p-4">
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                {supplementalDetails.map(detail => (
                  <div key={detail.key}>
                    <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{detail.label}</dt>
                    <dd className="text-sm text-muted-foreground">{detail.value}</dd>
                  </div>
                ))}
                {filteredMetadataEntries.map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{key}</dt>
                    <dd className="text-sm text-muted-foreground">
                      {typeof value === 'object' && value !== null
                        ? JSON.stringify(value)
                        : String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
              {filteredMetadataEntries.length === 0 && (
                <p className="mt-4 text-sm text-muted-foreground">No additional metadata stored for this transaction.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionDetail;
