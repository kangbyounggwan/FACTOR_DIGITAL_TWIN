import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Company, Factory, ProductionLine, fetchCompanies, fetchCompanyFactories, fetchFactories, fetchFactoryLines } from '@/lib/api'

// 회사 목록 - 페이지 전환해도 캐시 유지
export function useCompanies() {
  const queryClient = useQueryClient()

  const { data: companies = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: ['companies'],
    queryFn: fetchCompanies,
    staleTime: 10 * 60 * 1000, // 10분간 캐시
  })

  const reload = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['companies'] })
  }, [queryClient])

  return { companies, loading, error: error as Error | null, reload }
}

// 회사별 공장 목록
export function useCompanyFactories(companyCode: string | null) {
  const { data: factories = [], isLoading: loading, error } = useQuery({
    queryKey: ['company-factories', companyCode],
    queryFn: () => fetchCompanyFactories(companyCode!),
    enabled: !!companyCode,
    staleTime: 10 * 60 * 1000,
  })

  return { factories, loading, error: error as Error | null }
}

// 전체 공장 목록
export function useFactories() {
  const queryClient = useQueryClient()

  const { data: factories = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: ['factories'],
    queryFn: fetchFactories,
    staleTime: 10 * 60 * 1000,
  })

  const reload = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['factories'] })
  }, [queryClient])

  return { factories, loading, error: error as Error | null, reload }
}

// 공장별 라인 목록
export function useFactoryLines(factoryCode: string | null) {
  const { data: lines = [], isLoading: loading, error } = useQuery({
    queryKey: ['factory-lines', factoryCode],
    queryFn: () => fetchFactoryLines(factoryCode!),
    enabled: !!factoryCode,
    staleTime: 10 * 60 * 1000,
  })

  return { lines, loading, error: error as Error | null }
}
