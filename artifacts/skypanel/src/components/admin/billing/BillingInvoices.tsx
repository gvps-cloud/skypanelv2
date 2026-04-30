import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, Download, FileText, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { injectInvoiceTheme } from '@/lib/invoiceTheme';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Invoice {
  id: string;
  organizationId: string;
  organizationName?: string;
  invoiceNumber: string;
  totalAmount: number;
  currency: string;
  createdAt: string;
  htmlContent?: string;
}

export const BillingInvoices: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const limit = 20;

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<{ invoices: Invoice[] }>(`/admin/billing/invoices?limit=${limit}&offset=${page * limit}`);
      setInvoices(data.invoices);
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const handleDownload = async (id: string, number: string) => {
    try {
      // Using fetch with blob for file download - credentials: include for HttpOnly cookie auth
      const apiUrl = import.meta.env.VITE_API_URL || '/api';
      
      const response = await fetch(`${apiUrl}/admin/billing/invoices/${id}/download`, {
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      // Sanitize filename to prevent XSS
      const safeFilename = `invoice-${number}.html`.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
      link.setAttribute('download', safeFilename);
      
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      toast.error('Failed to download invoice');
    }
  };

  const handleView = async (invoice: Invoice) => {
    try {
      const data = await apiClient.get<{ invoice: Invoice }>(`/admin/billing/invoices/${invoice.id}`);
      setViewInvoice(data.invoice);
    } catch {
      toast.error('Failed to load invoice details');
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No invoices found
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium flex items-center">
                    <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                    {inv.invoiceNumber}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{inv.organizationName || 'Unknown organization'}</span>
                      <span className="text-xs text-muted-foreground break-all">{inv.organizationId}</span>
                    </div>
                  </TableCell>
                  <TableCell>{new Date(inv.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {inv.totalAmount.toFixed(6)} {inv.currency}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleView(inv)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDownload(inv.id, inv.invoiceNumber)}>
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end space-x-2 py-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage(p => Math.max(0, p - 1))}
          disabled={page === 0 || loading}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage(p => p + 1)}
          disabled={invoices.length < limit || loading}
        >
          Next
        </Button>
      </div>

      {/* Invoice View Modal */}
      <Dialog open={!!viewInvoice} onOpenChange={(open) => !open && setViewInvoice(null)}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Invoice {viewInvoice?.invoiceNumber}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 w-full border rounded-md overflow-hidden bg-background">
            {viewInvoice?.htmlContent ? (
              <iframe 
                srcDoc={injectInvoiceTheme(viewInvoice.htmlContent)}
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
            <Button variant="outline" onClick={() => setViewInvoice(null)}>Close</Button>
            <Button onClick={() => viewInvoice && handleDownload(viewInvoice.id, viewInvoice.invoiceNumber)}>
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
