import { useState, useEffect, useCallback } from 'react'
import { Company, Factory, ProductionLine, fetchCompanies, fetchCompanyFactories, fetchFactories, fetchFactoryLines } from '@/lib/api'

export function useCompanies() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchCompanies()
      setCompanies(data)
    } catch (e) {
      setError(e as Error)
      setCompanies([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { companies, loading, error, reload: load }
}

export function useCompanyFactories(companyCode: string | null) {
  const [factories, setFactories] = useState<Factory[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const load = useCallback(async () => {
    if (!companyCode) {
      setFactories([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await fetchCompanyFactories(companyCode)
      setFactories(data)
    } catch (e) {
      setError(e as Error)
      setFactories([])
    } finally {
      setLoading(false)
    }
  }, [companyCode])

  useEffect(() => {
    load()
  }, [load])

  return { factories, loading, error, reload: load }
}

export function useFactories() {
  const [factories, setFactories] = useState<Factory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchFactories()
      setFactories(data)
    } catch (e) {
      setError(e as Error)
      setFactories([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { factories, loading, error, reload: load }
}

export function useFactoryLines(factoryCode: string | null) {
  const [lines, setLines] = useState<ProductionLine[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const load = useCallback(async () => {
    if (!factoryCode) {
      setLines([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await fetchFactoryLines(factoryCode)
      setLines(data)
    } catch (e) {
      setError(e as Error)
      setLines([])
    } finally {
      setLoading(false)
    }
  }, [factoryCode])

  useEffect(() => {
    load()
  }, [load])

  return { lines, loading, error, reload: load }
}
