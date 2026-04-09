import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    // Return a mock client during build time to avoid errors
    if (typeof window === 'undefined') {
      return {
        auth: {
          getUser: () => Promise.resolve({ data: { user: null }, error: null }),
          getSession: () => Promise.resolve({ data: { session: null }, error: null }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        },
        from: () => ({
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'Build mode' } }) }) }),
          insert: () => Promise.resolve({ data: null, error: { message: 'Build mode' } }),
          update: () => Promise.resolve({ data: null, error: { message: 'Build mode' } }),
          delete: () => Promise.resolve({ data: null, error: { message: 'Build mode' } }),
          upsert: () => Promise.resolve({ data: null, error: { message: 'Build mode' } }),
        }),
        rpc: () => Promise.resolve({ data: null, error: { message: 'Build mode' } }),
        storage: {
          from: () => ({
            upload: () => Promise.resolve({ data: null, error: { message: 'Build mode' } }),
            getPublicUrl: () => ({ data: { publicUrl: '' } }),
          }),
        },
      } as any
    }
    throw new Error('Supabase environment variables are not set')
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}