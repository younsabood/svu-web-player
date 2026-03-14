import { useEffect, useRef, useState } from 'react';
import { fetchSvu } from '../../lib/svuApi';

export const useAcademicSetup = ({ enabled, savedTerm = '', savedProgram = '' }) => {
  const [terms, setTerms] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [localTerm, setLocalTerm] = useState(savedTerm);
  const [localProgram, setLocalProgram] = useState(savedProgram);
  const [loadingStage, setLoadingStage] = useState('idle');
  const [error, setError] = useState('');
  const requestRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    setLocalTerm(savedTerm || '');
    setLocalProgram(savedProgram || '');
  }, [enabled, savedProgram, savedTerm]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const requestId = ++requestRef.current;

    const loadInitialData = async () => {
      setError('');
      setLoadingStage('terms');

      try {
        const nextTerms = await fetchSvu('init');
        if (cancelled || requestId !== requestRef.current) return;

        setTerms(nextTerms);

        const selectedTerm = savedTerm || '';
        if (!selectedTerm) {
          setPrograms([]);
          return;
        }

        setLoadingStage('programs');
        const nextPrograms = await fetchSvu('term', { val: selectedTerm });
        if (cancelled || requestId !== requestRef.current) return;

        setPrograms(nextPrograms);
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError.message);
        }
      } finally {
        if (!cancelled && requestId === requestRef.current) {
          setLoadingStage('idle');
        }
      }
    };

    loadInitialData();

    return () => {
      cancelled = true;
    };
  }, [enabled, savedTerm]);

  const reload = async () => {
    const requestId = ++requestRef.current;
    setError('');
    setLoadingStage('terms');

    try {
      const nextTerms = await fetchSvu('init');
      if (requestId !== requestRef.current) return;

      setTerms(nextTerms);

      if (!localTerm) {
        setPrograms([]);
        return;
      }

      setLoadingStage('programs');
      const nextPrograms = await fetchSvu('term', { val: localTerm });
      if (requestId !== requestRef.current) return;

      setPrograms(nextPrograms);
    } catch (requestError) {
      if (requestId === requestRef.current) {
        setError(requestError.message);
      }
    } finally {
      if (requestId === requestRef.current) {
        setLoadingStage('idle');
      }
    }
  };

  const handleTermChange = async (value) => {
    const requestId = ++requestRef.current;
    setLocalTerm(value);
    setLocalProgram('');
    setPrograms([]);
    setError('');

    if (!value) {
      setLoadingStage('idle');
      return;
    }

    setLoadingStage('programs');

    try {
      const nextPrograms = await fetchSvu('term', { val: value });
      if (requestId !== requestRef.current) return;
      setPrograms(nextPrograms);
    } catch (requestError) {
      if (requestId === requestRef.current) {
        setError(requestError.message);
      }
    } finally {
      if (requestId === requestRef.current) {
        setLoadingStage('idle');
      }
    }
  };

  return {
    terms,
    programs,
    localTerm,
    localProgram,
    loadingStage,
    error,
    isBusy: loadingStage !== 'idle',
    setError,
    setLocalProgram,
    handleTermChange,
    reload,
  };
};
