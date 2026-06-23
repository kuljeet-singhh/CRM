import { useCallback, useEffect, useRef, useState } from 'react';
import { FileImage, Loader2, ScanLine } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { api, ApiError } from '@/lib/api';
import { OCR_ACCEPT_ATTR } from '@/lib/ocr/constants';
import { parseBusinessCard } from '@/lib/ocr/parseBusinessCard';
import { terminateOcrWorker } from '@/lib/ocr/tesseractWorker';
import { useOcr } from '@/hooks/useOcr';
import type { CrmContact } from '@/types';

interface BusinessCardScanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type FormState = {
  name: string;
  email: string;
  company: string;
  title: string;
  linkedinUrl: string;
  phone: string;
  website: string;
};

const EMPTY_FORM: FormState = {
  name: '',
  email: '',
  company: '',
  title: '',
  linkedinUrl: '',
  phone: '',
  website: '',
};

export function BusinessCardScanModal({ open, onOpenChange }: BusinessCardScanModalProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { status, progress, progressStatus, text, error, recognize, reset } = useOcr();

  const showForm = status === 'ready' || (status === 'error' && text);

  const handleClose = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        reset();
        setForm(EMPTY_FORM);
        setSaveError(null);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        void terminateOcrWorker();
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange, previewUrl, reset]
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setSaveError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    await recognize(file);
  }

  useEffect(() => {
    if (status !== 'ready' || !text) return;
    const parsed = parseBusinessCard(text);
    setForm({
      name: parsed.name ?? '',
      email: parsed.email ?? '',
      company: parsed.company ?? '',
      title: parsed.title ?? '',
      linkedinUrl: parsed.linkedinUrl ?? '',
      phone: parsed.phone ?? '',
      website: parsed.website ?? '',
    });
  }, [status, text]);

  async function saveContact() {
    const email = form.email.trim().toLowerCase() || undefined;
    const linkedinUrl = form.linkedinUrl.trim() || undefined;
    if (!email && !linkedinUrl) {
      setSaveError('Enter an email or LinkedIn URL to save this contact.');
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const data = await api<{ contact: CrmContact; created: boolean }>('/api/contacts', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim() || undefined,
          email,
          company: form.company.trim() || undefined,
          title: form.title.trim() || undefined,
          linkedinUrl,
        }),
      });
      toast.success(
        data.created
          ? `Contact ${data.contact.name || data.contact.email || 'saved'} created`
          : `Contact ${data.contact.name || data.contact.email || 'updated'}`
      );
      void queryClient.invalidateQueries({ queryKey: ['contacts'] });
      handleClose(false);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'missing_identifier') {
          setSaveError('Enter an email or LinkedIn URL to save this contact.');
        } else if (err.code === 'invalid_url') {
          setSaveError('LinkedIn URL is not valid.');
        } else {
          setSaveError(err.message);
        }
      } else {
        setSaveError('Failed to save contact');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5" />
            Scan business card
          </DialogTitle>
          <DialogDescription>
            Photograph or upload a business card. Review extracted fields before saving.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept={OCR_ACCEPT_ATTR}
            capture="environment"
            className="hidden"
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />

          {!previewUrl && !showForm && (
            <button
              type="button"
              className="w-full rounded-lg border border-dashed border-border/60 p-8 text-center hover:bg-muted/40 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void handleFile(e.dataTransfer.files[0]);
              }}
            >
              <FileImage className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Choose card image or use camera</p>
              <p className="text-xs text-muted-foreground mt-1">JPEG, PNG, WebP — max 10 MB</p>
            </button>
          )}

          {previewUrl && (
            <img
              src={previewUrl}
              alt="Business card"
              className="max-h-36 mx-auto rounded-md border border-border/50 object-contain"
            />
          )}

          {status === 'loading' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {progressStatus || 'Reading card…'}
              </div>
              <Progress value={progress} />
            </div>
          )}

          {error && !showForm && <p className="text-sm text-destructive">{error}</p>}

          {showForm && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Review and edit fields before saving. Phone and website are not stored in v1.
              </p>
              <div className="grid gap-3">
                <div className="space-y-1">
                  <Label htmlFor="ocr-name">Name</Label>
                  <Input
                    id="ocr-name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ocr-email">Email</Label>
                  <Input
                    id="ocr-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ocr-company">Company</Label>
                  <Input
                    id="ocr-company"
                    value={form.company}
                    onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ocr-title">Title</Label>
                  <Input
                    id="ocr-title"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ocr-linkedin">LinkedIn URL</Label>
                  <Input
                    id="ocr-linkedin"
                    value={form.linkedinUrl}
                    onChange={(e) => setForm((f) => ({ ...f, linkedinUrl: e.target.value }))}
                  />
                </div>
                {(form.phone || form.website) && (
                  <div className="text-xs text-muted-foreground space-y-1 rounded-md bg-muted/40 p-2">
                    {form.phone && <p>Phone (not saved): {form.phone}</p>}
                    {form.website && <p>Website (not saved): {form.website}</p>}
                  </div>
                )}
              </div>
              {saveError && <p className="text-sm text-destructive">{saveError}</p>}
            </div>
          )}
        </div>

        {showForm && (
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                setForm(EMPTY_FORM);
                if (previewUrl) URL.revokeObjectURL(previewUrl);
                setPreviewUrl(null);
                fileInputRef.current?.click();
              }}
            >
              Scan another
            </Button>
            <Button type="button" onClick={() => void saveContact()} disabled={saving}>
              {saving ? 'Saving…' : 'Save contact'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
