import axios from 'axios';

/**
 * Create an axios instance with request cancellation support
 * Usage:
 *   const { request, cancel } = createCancellableRequest();
 *   try {
 *     const response = await request.get('/api/endpoint');
 *   } catch (error) {
 *     if (axios.isCancel(error)) {
 *       console.log('Request cancelled');
 *     }
 *   }
 *   // On cleanup
 *   cancel();
 */

// Store for active AbortControllers
const activeControllers = new Map();

/**
 * Create a cancellable axios request
 * @param {string} key - Unique key for the request (optional, for managing multiple requests)
 * @returns {{ request: AxiosInstance, cancel: Function, signal: AbortSignal }}
 */
export function createCancellableRequest(key = null) {
  // Cancel any existing request with the same key
  if (key && activeControllers.has(key)) {
    activeControllers.get(key).abort();
    activeControllers.delete(key);
  }

  const controller = new AbortController();
  
  if (key) {
    activeControllers.set(key, controller);
  }

  const request = axios.create({
    signal: controller.signal
  });

  const cancel = (reason = 'Request cancelled') => {
    controller.abort(reason);
    if (key) {
      activeControllers.delete(key);
    }
  };

  return {
    request,
    cancel,
    signal: controller.signal
  };
}

/**
 * Cancel all active requests
 */
export function cancelAllRequests() {
  for (const [key, controller] of activeControllers) {
    controller.abort();
  }
  activeControllers.clear();
}

/**
 * Cancel a specific request by key
 * @param {string} key - The key of the request to cancel
 */
export function cancelRequest(key) {
  if (activeControllers.has(key)) {
    activeControllers.get(key).abort();
    activeControllers.delete(key);
  }
}

/**
 * Check if an error is a cancellation error
 * @param {Error} error 
 * @returns {boolean}
 */
export function isRequestCancelled(error) {
  return axios.isCancel(error) || error?.name === 'CanceledError' || error?.name === 'AbortError';
}

/**
 * Hook-friendly request wrapper
 * Returns a function that creates a cancellable request
 * 
 * Usage in useEffect:
 *   useEffect(() => {
 *     const { execute, cancel } = useCancellableRequest();
 *     execute('/api/data').then(setData);
 *     return () => cancel();
 *   }, []);
 */
export function createRequestExecutor(baseConfig = {}) {
  let controller = null;

  const execute = async (url, config = {}) => {
    // Cancel any previous request
    if (controller) {
      controller.abort();
    }

    controller = new AbortController();

    try {
      const response = await axios({
        ...baseConfig,
        ...config,
        url,
        signal: controller.signal
      });
      return response.data;
    } catch (error) {
      if (!isRequestCancelled(error)) {
        throw error;
      }
      return null;
    }
  };

  const cancel = () => {
    if (controller) {
      controller.abort();
      controller = null;
    }
  };

  return { execute, cancel };
}

export default {
  createCancellableRequest,
  cancelAllRequests,
  cancelRequest,
  isRequestCancelled,
  createRequestExecutor
};
