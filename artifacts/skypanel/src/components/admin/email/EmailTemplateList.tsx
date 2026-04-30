import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Edit } from 'lucide-react';
import type { EmailTemplate } from '@/services/adminEmailTemplateService';
import { format } from 'date-fns';

interface EmailTemplateListProps {
  templates: EmailTemplate[];
  onEdit: (template: EmailTemplate) => void;
  isLoading?: boolean;
}

export const EmailTemplateList: React.FC<EmailTemplateListProps> = ({
  templates,
  onEdit,
  isLoading,
}) => {
  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading templates...</div>;
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Template Name</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Last Updated</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {templates.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="h-24 text-center">
                No templates found.
              </TableCell>
            </TableRow>
          ) : (
            templates.map((template) => (
              <TableRow key={template.id}>
                <TableCell className="font-medium">{template.name}</TableCell>
                <TableCell>{template.subject}</TableCell>
                <TableCell>
                  {template.updated_at
                    ? format(new Date(template.updated_at), 'MMM d, yyyy HH:mm')
                    : 'N/A'}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(template)}
                    className="h-8 w-8 p-0"
                  >
                    <span className="sr-only">Edit</span>
                    <Edit className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};
