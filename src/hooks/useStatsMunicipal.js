import { useMemo } from 'react';
import { useMatchesMunicipal } from './useMatchesMunicipal';
import { computeMunicipalStats } from '../lib/municipalStats';

export function useStatsMunicipal(season = null) {
  const { roundData, loading, error } = useMatchesMunicipal(season);
  const stats = useMemo(() => computeMunicipalStats(roundData), [roundData]);
  return { stats, loading, error };
}
