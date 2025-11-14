const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

async function handleResponse(res: Response) {
  if (!res.ok) {
    const data = await res.json().catch(() => ({ message: 'An error occurred' }));
    throw new Error(data.message || 'An error occurred');
  }
  return res.json();
}

export const api = {
  async register(username: string, password: string) {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    return handleResponse(res);
  },

  async login(username: string, password: string) {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    return handleResponse(res);
  },

  async getProfile(token: string) {
    const res = await fetch(`${API_URL}/user/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse(res);
  },

  async updateProfile(token: string, data: { username?: string; color?: string }) {
    const res = await fetch(`${API_URL}/user/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async getAllUsers(token: string) {
    const res = await fetch(`${API_URL}/user/all`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse(res);
  },
};
