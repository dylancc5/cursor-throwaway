import type {
  AuthStatusResponse,
  BurnConfig,
  BurnSnapshot,
  LoginResponse,
  LogoutResponse,
  PauseBurnResponse,
  StartBurnResponse,
  StopBurnResponse,
} from '@cursor-throwaway/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ApiClient {
  private base: string;

  constructor(baseUrl: string = API_BASE) {
    this.base = baseUrl.replace(/\/$/, '');
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.base}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
      });

      if (!response.ok) {
        let errMessage = `HTTP error ${response.status}`;
        try {
          const body = await response.json();
          if (body.error || body.message) {
            errMessage = body.error || body.message;
          }
        } catch {
          // ignore json parse error
        }
        throw new Error(errMessage);
      }

      return (await response.json()) as T;
    } catch (err: any) {
      console.warn(`[ApiClient] Request to ${url} failed:`, err.message);
      throw err;
    }
  }

  // Auth endpoints
  public async login(): Promise<LoginResponse> {
    return this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  public async getAuthStatus(sessionId: string): Promise<AuthStatusResponse> {
    return this.request<AuthStatusResponse>(`/auth/status/${encodeURIComponent(sessionId)}`, {
      method: 'GET',
    });
  }

  public async logout(): Promise<LogoutResponse> {
    return this.request<LogoutResponse>('/auth/logout', {
      method: 'POST',
    });
  }

  // Burn session endpoints
  public async startBurn(config: BurnConfig): Promise<StartBurnResponse> {
    return this.request<StartBurnResponse>('/burn/start', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  public async stopBurn(): Promise<StopBurnResponse> {
    return this.request<StopBurnResponse>('/burn/stop', {
      method: 'POST',
    });
  }

  public async pauseBurn(): Promise<PauseBurnResponse> {
    return this.request<PauseBurnResponse>('/burn/pause', {
      method: 'POST',
    });
  }

  public async getBurnStatus(): Promise<BurnSnapshot> {
    return this.request<BurnSnapshot>('/burn/status', {
      method: 'GET',
    });
  }

  public getEventsUrl(sessionId?: string): string {
    const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
    return `${this.base}/burn/events${query}`;
  }
}

export const apiClient = new ApiClient();
