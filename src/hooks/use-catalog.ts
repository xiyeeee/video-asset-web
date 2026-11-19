import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { getSnapshot, tick } from '@/services/mock/catalog'

export const catalogKey = ['catalog'] as const

export function useCatalog() {
  return useQuery({
    queryKey: catalogKey,
    queryFn: async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 240))
      return getSnapshot()
    },
    staleTime: Infinity,
  })
}

export function usePublishCatalog() {
  const client = useQueryClient()
  return () => {
    client.setQueryData(catalogKey, getSnapshot())
  }
}

export function useTaskSimulation() {
  const client = useQueryClient()
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (tick()) client.setQueryData(catalogKey, getSnapshot())
    }, 900)
    return () => window.clearInterval(timer)
  }, [client])
}
