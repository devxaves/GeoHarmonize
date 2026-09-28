"use client";

import React from "react";
import { motion } from "framer-motion";
import { Inbox, AlertTriangle, Search } from "lucide-react";

interface EmptyStateProps {
  icon?: "inbox" | "alert" | "search";
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon = "inbox", title, description, action }: EmptyStateProps) {
  const Icon = icon === "alert" ? AlertTriangle : icon === "search" ? Search : Inbox;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center p-8 text-center"
    >
      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
        <Icon className="w-6 h-6 text-slate-400" />
      </div>
      <div className="text-sm font-semibold text-slate-700">{title}</div>
      {description && <div className="text-xs text-slate-400 mt-1 max-w-xs">{description}</div>}
      {action && <div className="mt-4">{action}</div>}
    </motion.div>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ title = "Something went wrong", message, onRetry }: ErrorStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center p-8 text-center"
    >
      <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center mb-3">
        <AlertTriangle className="w-6 h-6 text-rose-500" />
      </div>
      <div className="text-sm font-semibold text-slate-700">{title}</div>
      <div className="text-xs text-slate-400 mt-1 max-w-xs">{message}</div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-sm transition-transform active:scale-95 cursor-pointer"
        >
          Try Again
        </button>
      )}
    </motion.div>
  );
}
