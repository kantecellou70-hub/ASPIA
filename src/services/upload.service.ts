import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system'
import { Platform } from 'react-native'
import { supabase } from '@/lib/supabase'
import { UPLOAD_LIMITS } from '@/constants/config'
import type { DocumentFile, UploadedDocument } from '@/types/upload.types'

/** Lit un fichier en Uint8Array, compatible web (blob:) et natif (file://). */
async function readFileBytes(uri: string): Promise<Uint8Array> {
  if (Platform.OS === 'web') {
    // Sur web, expo-document-picker retourne un blob: URL — on utilise fetch()
    const response = await fetch(uri)
    const arrayBuffer = await response.arrayBuffer()
    return new Uint8Array(arrayBuffer)
  }
  // Sur iOS / Android, on utilise expo-file-system
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' })
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}

export const uploadService = {
  async pickDocument(): Promise<DocumentFile | null> {
    const result = await DocumentPicker.getDocumentAsync({
      type: [...UPLOAD_LIMITS.ALLOWED_MIME_TYPES],
      copyToCacheDirectory: true,
    })

    if (result.canceled || result.assets.length === 0) return null

    const asset = result.assets[0]
    return {
      uri: asset.uri,
      name: asset.name,
      size: asset.size ?? 0,
      mimeType: asset.mimeType ?? 'application/pdf',
    }
  },

  async uploadDocument(
    file: DocumentFile,
    userId: string,
    onProgress?: (progress: number) => void,
  ): Promise<UploadedDocument> {
    if (file.size > UPLOAD_LIMITS.MAX_FILE_SIZE_BYTES) {
      throw new Error(`Le fichier dépasse la limite de ${UPLOAD_LIMITS.MAX_FILE_SIZE_MB} Mo`)
    }

    const fileName = `${userId}/${Date.now()}_${file.name}`

    const bytes = await readFileBytes(file.uri)

    onProgress?.(30)

    const { error: storageError } = await supabase.storage
      .from('documents')
      .upload(fileName, bytes, {
        contentType: file.mimeType,
        upsert: false,
      })

    if (storageError) throw storageError
    onProgress?.(60)

    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(fileName)

    const { data, error: dbError } = await supabase
      .from('documents')
      .insert({
        user_id: userId,
        name: file.name,
        storage_path: fileName,   // requis par analyze-document et generate-circuit
        file_url: urlData.publicUrl,
        file_size: file.size,
        mime_type: file.mimeType,
      })
      .select()
      .single()

    if (dbError) throw dbError
    onProgress?.(100)

    return data as UploadedDocument
  },

  async getUserDocuments(userId: string): Promise<UploadedDocument[]> {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data ?? []) as UploadedDocument[]
  },

  async deleteDocument(documentId: string): Promise<void> {
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId)

    if (error) throw error
  },
}
