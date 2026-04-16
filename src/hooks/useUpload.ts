import { useCallback } from 'react'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { uploadService } from '@/services/upload.service'
import { aiService, EdgeFunctionError } from '@/services/ai.service'
import { useAuthStore } from '@/store/authStore'
import { useUploadStore } from '@/store/uploadStore'
import { useUiStore } from '@/store/uiStore'
import { useOfflineStore } from '@/store/offlineStore'
import { useSession } from './useSession'

export function useUpload() {
  const { user } = useAuthStore()
  const { selectedFile, progress, documents, setSelectedFile, setProgress, addDocument, setCurrentDocumentId, reset } =
    useUploadStore()
  const { showToast, isOnline } = useUiStore()
  const { enqueueUpload } = useOfflineStore()
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

    // Mode hors-ligne : mettre en file d'attente
    if (!isOnline) {
      enqueueUpload({ file: selectedFile, userId: user.id })
      showToast({
        type: 'info',
        message: 'Réseau indisponible — document mis en file d\'attente',
      })
      setProgress({ status: 'idle', step: '' })
      setSelectedFile(null)
      return
    }

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

      // Chiffrement du PDF au repos (non-bloquant si échec — l'analyse continue)
      setProgress({ status: 'uploading', progress: 90, step: 'Chiffrement du document...' })
      try {
        await supabase.functions.invoke('encrypt-document', { body: { document_id: document.id } })
      } catch (encryptErr) {
        console.warn('encrypt-document failed (non-blocking):', encryptErr)
      }

      setProgress({ status: 'analyzing', progress: 0, step: 'Analyse IA du document...' })
      // analyze-document peuple les métadonnées mais n'est pas requis pour generate-circuit
      // On le lance en non-bloquant pour ne pas bloquer le flux si la fonction échoue
      aiService.analyzeDocument(document.id).catch((e) =>
        console.warn('[analyze-document] non-blocking failure:', e instanceof Error ? e.message : e),
      )

      setProgress({ status: 'generating', progress: 50, step: 'Génération du circuit...' })
      const circuit = await aiService.generateCircuit(document.id)

      setProgress({ status: 'completed', progress: 100, step: 'Prêt !' })
      router.push(`/circuit/${circuit.id}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Une erreur est survenue'

      if (err instanceof EdgeFunctionError && err.upgradeRequired) {
        setProgress({ status: 'idle', step: '' })
        showToast({ type: 'warning', message })
        router.push('/payment/plans')
        return
      }

      // Session expirée → redirige vers la connexion
      if (err instanceof EdgeFunctionError && err.sessionExpired) {
        setProgress({ status: 'idle', step: '' })
        showToast({ type: 'warning', message })
        router.replace('/(auth)/welcome')
        return
      }

      setProgress({ status: 'error', step: message })
      showToast({ type: 'error', message })
    }
  }, [selectedFile, user, isOnline, consumeSession, enqueueUpload, setProgress, setSelectedFile, addDocument, setCurrentDocumentId, showToast])

  return {
    selectedFile,
    progress,
    documents,
    pickDocument,
    startUpload,
    reset,
  }
}
