import { useState, useEffect } from 'react'
import NetInfo from '@react-native-community/netinfo'

/**
 * Détecte l'état du réseau en temps réel.
 * isOnline = false si la connexion est absente OU si Internet n'est pas joignable.
 */
export function useNetwork() {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    // Vérification initiale
    NetInfo.fetch().then((state) => {
      setIsOnline(!!(state.isConnected && state.isInternetReachable !== false))
    })

    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(!!(state.isConnected && state.isInternetReachable !== false))
    })

    return unsubscribe
  }, [])

  return { isOnline }
}
