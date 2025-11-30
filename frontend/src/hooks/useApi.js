import { useRef, useCallback, useEffect } from 'react';
import axios from 'axios';

/**
 * Hook for making cancellable API requests
 * Automatically cancels pending requests when component unmounts
 * 
 * Usage:
 *   const { get, post, cancel, isLoading } = useApi();
 *   
 *   useEffect(() => {
 *     get('/devices').then(setDevices);
 *     return () => cancel(); // Optional: auto-cancelled on unmount
 *   }, []);
 */
export function useApi() {
  const controllerRef = useRef(null);
  const loadingRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
    };
  }, []);

  const createRequest = useCallback(async (method, url, data = null, config = {}) => {
    // Cancel any previous request
    if (controllerRef.current) {
      controllerRef.current.abort();
    }

    controllerRef.current = new AbortController();
    loadingRef.current = true;

    try {
      const response = await axios({
        method,
        url,
        data,
        ...config,
        signal: controllerRef.current.signal
      });
      loadingRef.current = false;
      return response.data;
    } catch (error) {
      loadingRef.current = false;
      
      // Don't throw for cancelled requests
      if (axios.isCancel(error) || error?.name === 'CanceledError') {
        return null;
      }
      throw error;
    }
  }, []);

  const get = useCallback((url, config = {}) => 
    createRequest('get', url, null, config), [createRequest]);

  const post = useCallback((url, data, config = {}) => 
    createRequest('post', url, data, config), [createRequest]);

  const put = useCallback((url, data, config = {}) => 
    createRequest('put', url, data, config), [createRequest]);

  const del = useCallback((url, config = {}) => 
    createRequest('delete', url, null, config), [createRequest]);

  const cancel = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
  }, []);

  return {
    get,
    post,
    put,
    delete: del,
    cancel,
    isLoading: loadingRef.current
  };
}

/**
 * Hook for polling data with automatic cleanup
 * 
 * Usage:
 *   const { data, error, isLoading, refresh } = usePolling('/devices', 10000);
 */
export function usePolling(url, interval = 10000, options = {}) {
  const { enabled = true, onSuccess, onError } = options;
  const controllerRef = useRef(null);
  const intervalRef = useRef(null);
  const dataRef = useRef(null);
  const errorRef = useRef(null);
  const loadingRef = useRef(true);

  const fetchData = useCallback(async () => {
    if (controllerRef.current) {
      controllerRef.current.abort();
    }

    controllerRef.current = new AbortController();

    try {
      const response = await axios.get(url, {
        signal: controllerRef.current.signal
      });
      dataRef.current = response.data;
      errorRef.current = null;
      loadingRef.current = false;
      onSuccess?.(response.data);
    } catch (error) {
      if (!axios.isCancel(error)) {
        errorRef.current = error;
        loadingRef.current = false;
        onError?.(error);
      }
    }
  }, [url, onSuccess, onError]);

  useEffect(() => {
    if (!enabled) return;

    // Initial fetch
    fetchData();

    // Set up polling
    intervalRef.current = setInterval(fetchData, interval);

    return () => {
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, interval, fetchData]);

  return {
    data: dataRef.current,
    error: errorRef.current,
    isLoading: loadingRef.current,
    refresh: fetchData
  };
}

export default useApi;
