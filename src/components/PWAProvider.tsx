'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bell, BellOff, Loader2 } from 'lucide-react'
import { cn, urlBase64ToUint8Array } from '@/lib/utils'

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((registration) => {
        setSwRegistration(registration)
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                if (confirm('A new version of Toothpoint is available. Reload to update?')) {
                  window.location.reload()
                }
              }
            })
          }
        })
      }).catch((error) => {
        console.error('Service Worker registration failed:', error)
      })
    }

    if ('Notification' in window) {
      setPermission(Notification.permission)
    }
  }, [])

  const subscribe = async () => {
    if (!swRegistration) return

    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!profile) return

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidPublicKey) {
        console.error('VAPID public key not configured')
        return
      }

      const pushSubscription = await swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource,
      })

      const subscriptionData = {
        endpoint: pushSubscription.endpoint,
        keys: {
          p256dh: btoa(String.fromCharCode(...new Uint8Array(pushSubscription.getKey('p256dh')!))),
          auth: btoa(String.fromCharCode(...new Uint8Array(pushSubscription.getKey('auth')!))),
        },
      }

      const response = await fetch('/api/push-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscriptionData),
      })

      if (response.ok) {
        setSubscription(pushSubscription)
        setPermission('granted')
      }
    } catch (error) {
      console.error('Push subscription error:', error)
    } finally {
      setLoading(false)
    }
  }

  const unsubscribe = async () => {
    if (!subscription) return

    setLoading(true)
    try {
      await fetch(`/api/push-subscription?endpoint=${encodeURIComponent(subscription.endpoint)}`, {
        method: 'DELETE',
      })
      await subscription.unsubscribe()
      setSubscription(null)
      setPermission('default')
    } catch (error) {
      console.error('Push unsubscription error:', error)
    } finally {
      setLoading(false)
    }
  }

  const requestPermission = async () => {
    if (!('Notification' in window)) return

    const perm = await Notification.requestPermission()
    setPermission(perm)
    if (perm === 'granted') {
      await subscribe()
    }
  }

  return (
    <PWAContext.Provider value={{ swRegistration, subscription, permission, loading, subscribe, unsubscribe, requestPermission }}>
      {children}
    </PWAContext.Provider>
  )
}

const PWAContext = React.createContext<{
  swRegistration: ServiceWorkerRegistration | null
  subscription: PushSubscription | null
  permission: NotificationPermission
  loading: boolean
  subscribe: () => Promise<void>
  unsubscribe: () => Promise<void>
  requestPermission: () => Promise<void>
} | null>(null)

export function usePWA() {
  const context = React.useContext(PWAContext)
  if (!context) {
    throw new Error('usePWA must be used within a PWAProvider')
  }
  return context
}

export function PushNotificationButton() {
  const { permission, loading, subscribe, unsubscribe, requestPermission } = usePWA()

  if (permission === 'default') {
    return (
      <button
        onClick={requestPermission}
        disabled={loading}
        className={cn('btn-outline flex items-center gap-2', loading && 'opacity-50')}
      >
        <Bell className="h-4 w-4" />
        Enable Notifications
      </button>
    )
  }

  if (permission === 'granted') {
    return (
      <button
        onClick={unsubscribe}
        disabled={loading}
        className={cn('btn-secondary flex items-center gap-2', loading && 'opacity-50')}
      >
        <BellOff className="h-4 w-4" />
        Disable Notifications
      </button>
    )
  }

  return (
    <button
      onClick={requestPermission}
      disabled={loading}
      className={cn('btn-outline flex items-center gap-2', loading && 'opacity-50')}
    >
      <Bell className="h-4 w-4" />
      Notifications Blocked
    </button>
  )
}

import React from 'react'