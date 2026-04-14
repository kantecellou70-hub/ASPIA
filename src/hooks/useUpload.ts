import { useCallback } from 'react'
import { router } from 'expo-router'
import { uploadService } from '@/services/upload.service'
import { aiService } from '@/services/ai.service'
import { useAuthStore } from '@/store/authStore'
import { useUploadStore } from '@/store/uploadStore'
import { useUiStore } from '@/store/uiStore'
import { useSession } from './useSession'

export function useUpload() {
  const { user } = useAuthStore()
  const { selectedFile, progress, documents, setSelectedFile, setProgress, addDocument, setCurrentDocumentId, reset } =
    useUploadStore()
  const { showToast } = useUiStore()
  const { consumeSession } = useSession()

  const pickDocument = useCallback(async () => {
    setProgress({ status: 'selecting', step: 'Sélection du fichier...' })
    const file = await uploadService.pickDocument()
    if (file) {
      setSelectedFile(file)
      setProgress({ status: 'idle', step: '' })
    } else {
      setProgress({ status: 'idle', step: '' })
    }
  }, [setSelectedFile, setProgress])

  const startUpload = useCallback(async () => {
    if (!selectedFile || !user) return

    const sessionGranted = await consumeSession()
    if (!sessionGranted) return

    try {
      setProgress({ status: 'uploading', progress: 10, step: 'Upload en cours...' })

      const document = await uploadService.uploadDocument(
        selectedFile,
        user.id,
        (p) => setProgress({ progress: p }),
      )
      addDocument(document)
      setCurrentDocumentId(document.id)

      setProgress({ status: 'analyzing', progress: 0, step: 'Analyse IA du document...' })
      await aiService.analyzeDocument(document.id)

      setProgress({ status: 'generating', progress: 50, step: 'Génération du circuit...' })
      const circuit = await aiService.generateCircuit(document.id)

      setProgress({ status: 'completed', progress: 100, step: 'Prêt !' })
      router.push(`/circuit/${circuit.id}`)
    } catch (err) {
      setProgress({ status: 'error', step: 'Une erreur est survenue' })
      showToast({ type: 'error', message: 'Échec du traitement du document' })
    }
  }, [selectedFile, user, consumeSession, setProgress, addDocument, setCurrentDocumentId, showToast])

  return {
    selectedFile,
    progress,
    documents,
    pickDocument,
    startUpload,
    reset,
  }
}
