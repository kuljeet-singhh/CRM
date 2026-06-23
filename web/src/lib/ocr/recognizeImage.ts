import { validateImageFile } from './constants';
import { getOcrWorker, setOcrProgressHandler, type OcrProgress } from './tesseractWorker';

export async function recognizeFile(
  file: File,
  onProgress?: (progress: OcrProgress) => void
): Promise<string> {
  const validationError = validateImageFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  setOcrProgressHandler(onProgress ?? null);
  const worker = await getOcrWorker();
  const result = await worker.recognize(file, { rotateAuto: true });
  return result.data.text.trim();
}

export async function recognizeDataUrl(
  dataUrl: string,
  onProgress?: (progress: OcrProgress) => void
): Promise<string> {
  setOcrProgressHandler(onProgress ?? null);
  const worker = await getOcrWorker();
  const result = await worker.recognize(dataUrl, { rotateAuto: true });
  return result.data.text.trim();
}
