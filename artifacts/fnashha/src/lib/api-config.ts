const envApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "");
const baseUrl = (import.meta.env.BASE_URL as string | undefined)?.replace(/\/$/, "");

export const API_BASE: string = envApiUrl ?? baseUrl ?? "";
