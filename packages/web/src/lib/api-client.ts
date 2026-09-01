import type {
  AuthStatusResponse,
  BurnConfig,
  BurnSnapshot,
  LoginResponse,
  LogoutResponse,
  PauseBurnResponse,
  ResumeBurnResponse,
  StartBurnResponse,
  StopBurnResponse,
} from '@cursor-burner/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ApiClient {
  private base: string;

  constructor(baseUrl: string = API_BASE) {
    this.base = baseUrl.replace(/\/$/, '');
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.base}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
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
  }

  public async login(): Promise<LoginResponse> {
    return this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  public async getAuthStatus(sessionId: string): Promise<AuthStatusResponse> {
    return this.request<AuthStatusResponse>(
      `/auth/status/${encodeURIComponent(sessionId)}`,
      { method: 'GET' },
    );
  }

  public async logout(): Promise<LogoutResponse> {
    return this.request<LogoutResponse>('/auth/logout', {
      method: 'POST',
    });
  }

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

  public async resumeBurn(): Promise<ResumeBurnResponse> {
    return this.request<ResumeBurnResponse>('/burn/resume', {
      method: 'POST',
    });
  }

  public async getBurnStatus(): Promise<BurnSnapshot> {
    return this.request<BurnSnapshot>('/burn/status', {
      method: 'GET',
    });
  }

  public getEventsUrl(): string {
    return `${this.base}/burn/events`;
  }
}

export const apiClient = new ApiClient();
