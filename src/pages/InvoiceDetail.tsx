/**
 * Invoice Detail Page
 * Displays and allows downloading of invoices
 *
 * SECURITY: Uses DOMPurify to sanitize HTML content before rendering
 * to prevent XSS attacks via malicious invoice content.
 */

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Download, ChevronLeft, Loader } from "lucide-react";
import DOMPurify from "dompurify";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import "@/styles/invoice-preview.css";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";

interface Invoice {
  id: string;
  organizationId: string;
  invoiceNumber: string;
  htmlContent: string;
  data: Record<string, unknown>;
  totalAmount: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

const InvoiceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const loadInvoice = useCallback(async () => {
    if (!id) {
      navigate("/billing");
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`/api/invoices/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          toast.error("Invoice not found");
        } else {
          toast.error("Failed to load invoice");
        }
        navigate("/billing");
        return;
      }

      const data = await response.json();
      if (data.success) {
        setInvoice(data.invoice);
      }
    } catch (error) {
      console.error("Failed to load invoice:", error);
      toast.error("Failed to load invoice");
      navigate("/billing");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    loadInvoice();
  }, [loadInvoice]);

  const handleDownload = async () => {
    if (!id) return;

    setDownloading(true);
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`/api/invoices/${id}/download`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        toast.error("Failed to download invoice");
        return;
      }

      // Sanitize filename to prevent XSS
      const sanitizeFilename = (name: string) =>
        name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
      const safeFilename = sanitizeFilename(
        `invoice-${invoice?.invoiceNumber || id}.html`,
      );

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = safeFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("Invoice downloaded successfully");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download invoice");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <>
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <Loader className="h-12 w-12 animate-spin text-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Loading invoice...</p>
          </div>
        </div>
      </>
    );
  }

  if (!invoice) {
    return (
      <>
        <div className="p-8">
          <div className="max-w-4xl mx-auto space-y-4">
            <Button variant="ghost" onClick={() => navigate("/billing")}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back to Billing
            </Button>
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">Invoice not found</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="p-4 sm:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate("/billing")}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back to Billing
            </Button>
            <Button onClick={handleDownload} disabled={downloading}>
              <Download className="h-4 w-4 mr-2" />
              {downloading ? "Downloading..." : "Download as HTML"}
            </Button>
          </div>

          {/* Invoice HTML Preview */}
          <Card>
            <CardContent className="p-4 sm:p-8">
              <div
                className="invoice-preview prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(invoice.htmlContent),
                }}
              />
            </CardContent>
          </Card>

          {/* Invoice Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription className="text-xs font-semibold uppercase">
                  Invoice Number
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">{invoice.invoiceNumber}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription className="text-xs font-semibold uppercase">
                  Total Amount
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">
                  {invoice.currency} ${invoice.totalAmount.toFixed(4)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription className="text-xs font-semibold uppercase">
                  Date
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">
                  {new Date(invoice.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
};

export default InvoiceDetail;
