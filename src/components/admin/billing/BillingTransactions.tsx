import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Pagination from '@/components/ui/Pagination';
import { Loader2, ArrowUpRight, ArrowDownLeft, RefreshCw, FileText, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Transaction {
  id: string;
  organization_id: string;
  organization_name?: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string;
  payment_provider: string;
  description: string;
  created_at: string;
  user_email: string;
  user_name: string;
}

interface InvoicePreview {
  id: string;
  invoiceNumber?: string;
  htmlContent?: string;
}

export const BillingTransactions: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [invoiceLoadingId, setInvoiceLoadingId] = useState<string | null>(null);
  const [viewInvoice, setViewInvoice] = useState<InvoicePreview | null>(null);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const limit = 20;

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/admin/billing/transactions?limit=${limit}&offset=${page * limit}`;
      if (filterStatus !== 'all') url += `&status=${filterStatus}`;
      if (filterType !== 'all') url += `&type=${filterType}`;
      
      const data = await apiClient.get<{ transactions: Transaction[]; pagination: { total: number } }>(url);
      setTransactions(data.transactions);
      setTotal(data.pagination.total);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, filterType]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge className="bg-green-500 hover:bg-green-600">Completed</Badge>;
      case 'failed': return <Badge variant="destructive">Failed</Badge>;
      case 'refunded': return <Badge variant="secondary">Refunded</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleViewInvoice = async (transactionId: string) => {
    setInvoiceLoadingId(transactionId);
    try {
      const created = await apiClient.post<{ success: boolean; invoiceId?: string; error?: string }>(
        `/admin/billing/transactions/${transactionId}/invoice`
      );

      if (!created?.success || !created.invoiceId) {
        toast.error(created?.error || 'Failed to generate invoice');
        return;
      }

      const detail = await apiClient.get<{ success: boolean; invoice?: { invoiceNumber?: string; htmlContent?: string } }>(
        `/admin/billing/invoices/${created.invoiceId}`
      );

      const html = detail?.invoice?.htmlContent;
      if (!detail?.success || !html) {
        toast.error('Failed to load invoice HTML');
        return;
      }

      setViewInvoice({
        id: created.invoiceId,
        invoiceNumber: detail.invoice?.invoiceNumber,
        htmlContent: html,
      });
    } catch (error) {
      console.error('Failed to view invoice:', error);
      toast.error('Failed to view invoice');
    } finally {
      setInvoiceLoadingId(null);
    }
  };

  const handleDownloadInvoice = async (invoiceId: string, invoiceNumber?: string) => {
    try {
      const authToken = localStorage.getItem('auth_token') || localStorage.getItem('token');
      const apiUrl = import.meta.env.VITE_API_URL || '/api';

      const response = await fetch(`${apiUrl}/admin/billing/invoices/${invoiceId}/download`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      // Sanitize filename to prevent XSS
      const safeFilename = `invoice-${invoiceNumber || invoiceId}.html`.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
      link.setAttribute('download', safeFilename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Failed to download invoice:', error);
      toast.error('Failed to download invoice');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(0); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={(v) => { setFilterType(v); setPage(0); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="credit">Credit (Incoming)</SelectItem>
              <SelectItem value="debit">Debit (Outgoing)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={fetchTransactions} disabled={loading}>
          <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No transactions found
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                    {new Date(tx.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                        <span className="font-medium">{tx.user_name}</span>
                        <span className="text-xs text-muted-foreground">{tx.user_email}</span>
                      </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{tx.organization_name || 'Unknown organization'}</span>
                      <span className="text-xs text-muted-foreground break-all">{tx.organization_id}</span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[300px] truncate" title={tx.description}>
                    {tx.description}
                  </TableCell>
                  <TableCell>
                    <div className={cn("flex items-center font-medium", tx.amount > 0 ? "text-green-600" : "text-red-600")}>
                      {tx.amount > 0 ? <ArrowDownLeft className="mr-1 h-3 w-3" /> : <ArrowUpRight className="mr-1 h-3 w-3" />}
                      {Math.abs(tx.amount).toFixed(2)} {tx.currency}
                    </div>
                  </TableCell>
                  <TableCell className="capitalize">{tx.payment_method?.replace('_', ' ') || tx.payment_provider}</TableCell>
                  <TableCell>{getStatusBadge(tx.status)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewInvoice(tx.id)}
                      disabled={invoiceLoadingId === tx.id}
                    >
                      {invoiceLoadingId === tx.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FileText className="mr-2 h-4 w-4" />
                      )}
                      View Invoice
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={page + 1}
        totalItems={total}
        itemsPerPage={limit}
        onPageChange={(newPage) => setPage(newPage - 1)}
        showItemsPerPage={false}
      />

      <Dialog open={!!viewInvoice} onOpenChange={(open) => !open && setViewInvoice(null)}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Invoice {viewInvoice?.invoiceNumber || viewInvoice?.id}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 w-full border rounded-md overflow-hidden bg-white">
            {viewInvoice?.htmlContent ? (
              <iframe
                srcDoc={viewInvoice.htmlContent}
                className="w-full h-full border-none"
                title="Invoice Preview"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setViewInvoice(null)}>
              Close
            </Button>
            <Button onClick={() => viewInvoice && handleDownloadInvoice(viewInvoice.id, viewInvoice.invoiceNumber)}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
