import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BillingOverview } from './BillingOverview';
import { BillingClientList } from './BillingClientList';
import { BillingTransactions } from './BillingTransactions';
import { BillingInvoices } from './BillingInvoices';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export const BillingDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="space-y-6 p-6 pb-16">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Billing & Finance</h2>
          <p className="text-muted-foreground">
            Manage client billing, view financial reports, and handle transactions.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-4">
          <BillingOverview />
        </TabsContent>
        <TabsContent value="clients" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Client Billing</CardTitle>
              <CardDescription>
                View and manage client wallet balances and billing status.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BillingClientList />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Transactions</CardTitle>
              <CardDescription>
                Global history of all payment transactions and adjustments.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BillingTransactions />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="invoices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
              <CardDescription>
                Generated invoices and billing statements.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BillingInvoices />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
