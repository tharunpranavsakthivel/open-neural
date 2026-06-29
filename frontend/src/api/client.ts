/**
 * Axios API client factory and error mapping for OpenNeural.
 *
 * Configures an Axios instance with base URL, authentication headers,
 * and error mapping interceptors to translate standard AxiosErrors into
 * structured ApiError types.
 *
 * @module api/client
 */
import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
} from "axios";
import { getBackendSecret, getBackendPort } from "../stores/appStore";

/**
 * Structured API error interface representing HTTP and validation errors.
 */
export interface ApiError {
  /** HTTP status code (e.g., 400, 401, 403, 404, 422, 500), or 0 for network failures */
  status: number;
  /** Plain-language error description */
  message: string;
  /** Field-level validation errors (primarily populated on 422 Unprocessable Entity) */
  field_errors?: Record<string, string>;
}

/**
 * Check if an error object is a typed ApiError.
 *
 * @param error - The error object to check
 * @returns True if the object matches the ApiError shape
 */
export function isApiError(error: any): error is ApiError {
  return (
    error !== null &&
    typeof error === "object" &&
    typeof error.status === "number" &&
    typeof error.message === "string"
  );
}

/**
 * Create a new Axios client instance targeted at a specific backend port.
 *
 * Automatically injects the shared X-OpenNeural-Secret header retrieved
 * from the app store and maps standard HTTP errors to ApiError objects.
 *
 * @param port - The dynamic backend port assigned on startup
 * @returns A configured AxiosInstance
 */
export function createApiClient(port: number): AxiosInstance {
  const client = axios.create({
    baseURL: `http://127.0.0.1:${port}/api/v1`,
    headers: {
      "Content-Type": "application/json",
    },
  });

  // Request interceptor: Inject secret authentication header (Task 29, 210)
  client.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const secret = getBackendSecret();
      if (secret && config.headers) {
        config.headers["X-OpenNeural-Secret"] = secret;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    },
  );

  // Response interceptor: Map standard HTTP/Axios errors to unified ApiError shape
  client.interceptors.response.use(
    (response) => {
      return response;
    },
    (error: unknown) => {
      const apiError: ApiError = {
        status: 500,
        message: "An unexpected error occurred.",
      };

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<any>;
        if (axiosError.response) {
          // The server responded with a status code outside the 2xx range
          apiError.status = axiosError.response.status;

          const data = axiosError.response.data;
          if (data && typeof data === "object") {
            if ("detail" in data) {
              const detail = data.detail;
              if (typeof detail === "string") {
                apiError.message = detail;
              } else if (Array.isArray(detail)) {
                // Map FastAPI's list of validation errors to field_errors key-value dictionary (Task 54)
                apiError.message = "Validation failed.";
                apiError.field_errors = {};
                for (const err of detail) {
                  if (err && typeof err === "object") {
                    const loc = err.loc;
                    const msg = err.msg;
                    if (
                      Array.isArray(loc) &&
                      loc.length > 0 &&
                      typeof msg === "string"
                    ) {
                      // Target the actual field name (the last element of loc)
                      const fieldName = String(loc[loc.length - 1]);
                      apiError.field_errors[fieldName] = msg;
                    }
                  }
                }
              } else {
                apiError.message = JSON.stringify(detail);
              }
            } else if ("message" in data && typeof data.message === "string") {
              apiError.message = data.message;
            } else {
              apiError.message =
                axiosError.message ||
                `HTTP Error ${axiosError.response.status}`;
            }
          } else {
            apiError.message =
              axiosError.message || `HTTP Error ${axiosError.response.status}`;
          }
        } else if (axiosError.request) {
          // The request was made but no response was received (e.g. network timeout or server down)
          apiError.status = 0;
          apiError.message =
            "No response received from the backend. Please check that the backend is running.";
        } else {
          // Something happened in setting up the request
          apiError.status = 0;
          apiError.message =
            axiosError.message || "Request configuration error.";
        }
      } else if (error instanceof Error) {
        apiError.message = error.message;
      }

      // Reject the promise with the mapped ApiError
      return Promise.reject(apiError);
    },
  );

  return client;
}

let activeClient: AxiosInstance | null = null;
let cachedPort: number | null = null;

/**
 * Get the active API client instance.
 * Automatically handles dynamic port changes and caches the instance.
 *
 * @returns The AxiosInstance configured with the current backend port.
 * @throws Error if the backend port is not yet set in the store.
 */
export function getApiClient(): AxiosInstance {
  const port = getBackendPort();
  if (port === null) {
    throw new Error(
      "Backend port not set. Ensure getBackendPort() has resolved.",
    );
  }

  if (activeClient && cachedPort === port) {
    return activeClient;
  }

  activeClient = createApiClient(port);
  cachedPort = port;
  return activeClient;
}
