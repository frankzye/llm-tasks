"use client";

import type { ChatAddToolApproveResponseFunction } from "ai";
import { createContext, useContext } from "react";

export const ToolApprovalResponseContext = createContext<
  ChatAddToolApproveResponseFunction | undefined
>(undefined);

export function useToolApprovalResponse() {
  return useContext(ToolApprovalResponseContext);
}
