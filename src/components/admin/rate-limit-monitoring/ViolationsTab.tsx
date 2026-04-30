import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { RateLimitMetrics } from './types';

interface ViolationsTabProps {
  metrics: RateLimitMetrics;
}

export function ViolationsTab({ metrics }: ViolationsTabProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top Violating Sources</CardTitle>
          <CardDescription>Users and IPs with the most rate limit violations</CardDescription>
        </CardHeader>
        <CardContent>
          {metrics.topViolatingIPs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No violations detected</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>User Type</TableHead>
                  <TableHead className="text-right">Violations</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.topViolatingIPs.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-mono text-sm">
                      {item.userId ? (
                        <div>
                          <div className="font-medium">
                            {item.userName || item.userEmail || item.userId}
                          </div>
                          {item.userName && item.userEmail && item.userName !== item.userEmail && (
                            <div className="text-xs text-muted-foreground">{item.userEmail}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Anonymous</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{item.ip}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {item.userType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{item.violations}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top Violating Endpoints</CardTitle>
          <CardDescription>API endpoints with the most rate limit violations</CardDescription>
        </CardHeader>
        <CardContent>
          {metrics.topViolatingEndpoints.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No violations detected</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Endpoint</TableHead>
                  <TableHead className="text-right">Violations</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.topViolatingEndpoints.map((endpoint, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-mono text-sm">{endpoint.endpoint}</TableCell>
                    <TableCell className="text-right font-medium">{endpoint.violations}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}