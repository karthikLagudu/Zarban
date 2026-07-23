"use client";

import { createContext, useContext } from "react";

export interface ContentUser {
  email: string;
  name: string | null;
  role: "Admin" | "Teacher" | "Viewer" | "Editor";
}

export const ContentContext = createContext<ContentUser | null>(null);

export function useContentUser() {
  return useContext(ContentContext);
}
