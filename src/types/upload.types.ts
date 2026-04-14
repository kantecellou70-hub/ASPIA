export type UploadStatus =
  | 'idle'
  | 'selecting'
  | 'uploading'
  | 'analyzing'
  | 'generating'
  | 'completed'
  | 'error'

export interface DocumentFile {
  uri: string
  name: string
  size: number
  mimeType: string
}

export interface UploadedDocument {
  id: string
  user_id: string
  name: string
  file_url: string
  file_size: number
  mime_type: string
  created_at: string
}

export interface UploadProgress {
  status: UploadStatus
  progress: number // 0–100
  step: string
  error?: string
}

export const UPLOAD_STEPS: Record<UploadStatus, string> = {
  idle: '',
  selecting: 'Sélection du fichier...',
  uploading: 'Upload en cours...',
  analyzing: 'Analyse IA du document...',
  generating: 'Génération du circuit...',
  completed: 'Prêt !',
  error: 'Une erreur est survenue',
}
