"use client";

import { createContext, useContext } from "react";

export interface AdminUser {
  email: string;
  name: string | null;
  role: "Admin" | "Teacher" | "Viewer" | "Editor";
}

export const AdminContext = createContext<AdminUser | null>(null);

export function useAdmin() {
  return useContext(AdminContext);
}
