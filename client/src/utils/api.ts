import axios from 'axios';

const API_BASE_URL = import.meta.env?.VITE_API_URL || 'http://localhost:8787';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 30000
});

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}


