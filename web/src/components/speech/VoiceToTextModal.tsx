import { useCallback, useEffect, useState } from 'react';
import { Copy, Mic, MicOff } from 'lucide-react';
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
import { formatTranscript } from '@/lib/speech/formatTranscript';
import { abortRecognition } from '@/lib/speech/speechRecognition';
import { useSpeechToText } from '@/hooks/useSpeechToText';

interface VoiceToTextModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VoiceToTextModal({ open, onOpenChange }: VoiceToTextModalProps) {
  const [reviewText, setReviewText] = useState('');
  const { status, text, interimText, error, start, stop, reset } = useSpeechToText();

  const handleClose = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        abortRecognition();
        reset();
        setReviewText('');
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange, reset]
  );

  useEffect(() => {
    if (status === 'ready') {
      setReviewText(formatTranscript(text));
    }
  }, [status, text]);

  async function copyText() {
    if (!reviewText) return;
    try {
      await navigator.clipboard.writeText(reviewText);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Could not copy to clipboard');
    }
  }

  const livePreview = formatTranscript(`${text}${interimText ? ` ${interimText}` : ''}`);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dictate text</DialogTitle>
          <DialogDescription>
            Microphone permission required. Speech is processed by your browser&apos;s speech
            service and is not uploaded to FlyCRM.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {status === 'unsupported' && (
            <p className="text-sm text-muted-foreground">
              Speech recognition is not available in this browser. Use Chrome, Edge, or Safari.
            </p>
          )}

          {status === 'idle' && (
            <Button type="button" className="w-full" size="lg" onClick={start}>
              <Mic className="h-5 w-5 mr-2" />
              Start dictation
            </Button>
          )}

          {status === 'listening' && (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2 py-4">
                <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Mic className="h-6 w-6 text-primary animate-pulse" />
                  <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                </span>
                <span className="text-sm text-muted-foreground">Listening…</span>
              </div>
              {livePreview ? (
                <p className="text-sm leading-relaxed min-h-[4rem] rounded-md border border-border/60 bg-muted/30 p-3">
                  {formatTranscript(text)}
                  {interimText && (
                    <span className="text-muted-foreground italic"> {interimText}</span>
                  )}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground text-center">Speak now…</p>
              )}
              <Button type="button" variant="outline" className="w-full" onClick={stop}>
                <MicOff className="h-4 w-4 mr-2" />
                Stop
              </Button>
            </div>
          )}

          {error && status === 'error' && (
            <div className="space-y-3">
              <p className="text-sm text-destructive">{error}</p>
              <Button type="button" variant="outline" onClick={start}>
                Try again
              </Button>
            </div>
          )}

          {status === 'ready' && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Review and edit text before copying.
              </p>
              <Textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                rows={16}
                spellCheck
                className="text-sm leading-7 min-h-[320px] max-h-[50vh] resize-y bg-muted/30 border-border/60"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void copyText()}
                  disabled={!reviewText}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    reset();
                    setReviewText('');
                    start();
                  }}
                >
                  Dictate again
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
