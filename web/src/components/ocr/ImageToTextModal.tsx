import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, FileImage, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { OCR_ACCEPT_ATTR } from '@/lib/ocr/constants';
import { formatOcrDisplayText } from '@/lib/ocr/formatOcrText';
import { terminateOcrWorker } from '@/lib/ocr/tesseractWorker';
import { useOcr } from '@/hooks/useOcr';

interface ImageToTextModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImageToTextModal({ open, onOpenChange }: ImageToTextModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [reviewText, setReviewText] = useState('');
  const { status, progress, progressStatus, text, error, recognize, reset } = useOcr();

  const handleClose = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        reset();
        setReviewText('');
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        void terminateOcrWorker();
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange, previewUrl, reset]
  );

  useEffect(() => {
    if (status === 'ready' && text) {
      setReviewText(formatOcrDisplayText(text));
    }
  }, [status, text]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    await recognize(file);
  }

  async function copyText() {
    if (!reviewText) return;
    try {
      await navigator.clipboard.writeText(reviewText);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Could not copy to clipboard');
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Extract text from image</DialogTitle>
          <DialogDescription>
            Upload or photograph an image. Text is recognized on your device and is not uploaded.
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

          {!previewUrl && status === 'idle' && (
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
              <p className="text-sm font-medium">Choose image or drag and drop</p>
              <p className="text-xs text-muted-foreground mt-1">JPEG, PNG, WebP, BMP, GIF — max 10 MB</p>
            </button>
          )}

          {previewUrl && (
            <img
              src={previewUrl}
              alt="Selected for OCR"
              className="max-h-40 mx-auto rounded-md border border-border/50 object-contain"
            />
          )}

          {status === 'loading' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {progressStatus || 'Recognizing text…'}
              </div>
              <Progress value={progress} />
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          {status === 'ready' && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Review and edit text — OCR may contain errors.
              </p>
              <Textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                rows={16}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                className="text-sm leading-7 min-h-[320px] max-h-[50vh] resize-y bg-muted/30 border-border/60"
              />
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => void copyText()} disabled={!reviewText}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    reset();
                    setReviewText('');
                    if (previewUrl) URL.revokeObjectURL(previewUrl);
                    setPreviewUrl(null);
                    fileInputRef.current?.click();
                  }}
                >
                  Scan another
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
