import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Mail } from 'lucide-react';

export interface EmailTemplate {
  id: number;
  name: string;
  subject: string;
  category: string;
  usage: number;
  body?: string;
}

const defaultTemplates: EmailTemplate[] = [
  {
    id: 1,
    name: 'Follow-up After Demo',
    subject: 'Thank you for attending our product demo',
    category: 'Follow-up',
    usage: 156,
    body: 'Hi,\n\nThank you for taking the time to attend our demo. I would love to hear your feedback and discuss next steps.\n\nBest regards',
  },
  {
    id: 2,
    name: 'Proposal Submission',
    subject: 'Your requested proposal - {{Company Name}}',
    category: 'Proposal',
    usage: 89,
    body: 'Please find attached our proposal for your review. Let me know if you have any questions.',
  },
  {
    id: 3,
    name: 'Contract Renewal',
    subject: 'Contract renewal opportunity - {{Contract Type}}',
    category: 'Renewal',
    usage: 67,
  },
  {
    id: 4,
    name: 'Meeting Scheduling',
    subject: "Let's schedule a meeting to discuss next steps",
    category: 'Scheduling',
    usage: 134,
    body: 'Would you be available for a brief call this week to discuss next steps?',
  },
];

interface EmailTemplatesProps {
  onUseTemplate: (template: { subject: string; body: string }) => void;
}

export function EmailTemplates({ onUseTemplate }: EmailTemplatesProps) {
  return (
    <Card className="bg-gradient-surface border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          Email Templates
        </CardTitle>
        <CardDescription>Pre-built templates to streamline your communications</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {defaultTemplates.map((template) => (
            <Card key={template.id} className="hover-glow transition-all duration-300 bg-background/50 border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">{template.name}</h3>
                  <Badge variant="outline">{template.category}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{template.subject}</p>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">Used {template.usage} times</div>
                  <Button
                    size="sm"
                    className="bg-gradient-primary text-primary-foreground hover:opacity-90"
                    onClick={() =>
                      onUseTemplate({
                        subject: template.subject,
                        body: template.body ?? '',
                      })
                    }
                  >
                    Use Template
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
