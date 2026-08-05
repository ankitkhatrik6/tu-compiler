"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { X, Copy, Check, Clock, QrCode, Share2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ActiveShare {
  share_code: string;
  folder_id: string;
  folder_name: string;
  is_active: boolean;
  expires_at: string;
  role?: "owner" | "importer";
}

interface ActiveSharesModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderIds: string[];
  onShowToast: (msg: string) => void;
}

const ActiveShareCard = ({
  share,
  onShowToast,
}: {
  share: ActiveShare;
  onShowToast: (msg: string) => void;
}) => {
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [isExpired, setIsExpired] = useState<boolean>(false);

  const shareLink = typeof window !== "undefined" ? `${window.location.origin}/?share=${share.share_code}` : "";

  useEffect(() => {
    if (!shareLink) return;
    QRCode.toDataURL(shareLink, {
      width: 120,
      margin: 2,
      color: {
        dark: "#0F172A",
        light: "#FFFFFF",
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error("QR Code generation error:", err));
  }, [shareLink]);

  useEffect(() => {
    if (!share.expires_at) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const exp = new Date(share.expires_at).getTime();
      const distance = exp - now;

      if (distance <= 0) {
        setTimeRemaining("Expired");
        setIsExpired(true);
        return;
      }

      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [share.expires_at]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(share.share_code);
    setCopiedCode(true);
    onShowToast("Share code copied to clipboard!");
    setTimeout(() => setCopiedCode(false), 2000);
  };

  if (isExpired) return null;

  return (
    <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-xl bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200/70 dark:border-[#2A2A2A]">
      <div className="relative p-2 bg-white rounded-lg shadow-xs border border-slate-200 dark:border-slate-300 shrink-0 self-center sm:self-start">
        {qrDataUrl ? (
          <Image
            src={qrDataUrl}
            alt="QR Code"
            width={80}
            height={80}
            unoptimized
            className="w-20 h-20 rounded-md"
          />
        ) : (
          <div className="w-20 h-20 flex items-center justify-center bg-slate-100">
            <QrCode className="w-6 h-6 text-slate-400 animate-pulse" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
              {share.folder_name}
            </h4>
            <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 mt-1 rounded-full border ${
              share.role === "importer"
                ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
            }`}>
              {share.role === "importer" ? "Imported" : "Shared by me"}
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0 self-start">
            <Clock className="w-3 h-3" />
            {timeRemaining}
          </span>
        </div>

        <div className="flex items-center justify-between mt-2">
          <div className="flex flex-col">
             <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold mb-1">
               Share Code
             </span>
             <div className="flex items-center gap-2">
               <div className="px-3 py-1 font-mono text-lg font-black tracking-widest text-blue-600 dark:text-blue-400 bg-blue-500/10 rounded-lg border border-blue-500/20">
                 {share.share_code}
               </div>
               <button
                 onClick={handleCopyCode}
                 className="p-1.5 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-200/70 dark:hover:bg-[#282828] rounded-md transition-all active:scale-95"
                 title="Copy Code"
               >
                 {copiedCode ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
               </button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ActiveSharesModal: React.FC<ActiveSharesModalProps> = ({
  isOpen,
  onClose,
  folderIds,
  onShowToast,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [shares, setShares] = useState<ActiveShare[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    const fetchShares = () => {
      setLoading(true);
      try {
        const activeSharesStr = localStorage.getItem("tucompiler_active_shares");
        let activeShares: any[] = [];
        if (activeSharesStr) {
          try {
            activeShares = JSON.parse(activeSharesStr);
          } catch (e) {
            activeShares = [];
          }
        }

        const now = Date.now();
        // Filter out expired ones
        const validShares = activeShares.filter((s: any) => {
          if (!s.expiresAt) return false;
          return new Date(s.expiresAt).getTime() > now;
        });

        // Filter out ones whose folderId is not in folderIds (deleted/removed folders)
        const currentShares = validShares.filter((s: any) => {
          return folderIds.includes(s.folderId);
        });

        // Save back cleaned list to localStorage if changed
        if (currentShares.length !== activeShares.length) {
          localStorage.setItem("tucompiler_active_shares", JSON.stringify(currentShares));
        }

        // Map client properties to API naming convention for ActiveShareCard
        const mappedShares: ActiveShare[] = currentShares.map((s: any) => ({
          share_code: s.shareCode,
          folder_id: s.folderId,
          folder_name: s.folderName,
          is_active: s.isActive ?? true,
          expires_at: s.expiresAt,
          role: s.role,
        }));

        setShares(mappedShares);
      } catch (err) {
        console.error("Failed to load active shares from localStorage:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchShares();
  }, [isOpen, folderIds]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative flex flex-col w-full max-w-lg max-h-[85vh] overflow-hidden bg-white dark:bg-[#141414] border border-slate-200/80 dark:border-[#282828] rounded-2xl shadow-2xl"
        >
          {/* Top Accent Line */}
          <div className="h-1 w-full bg-linear-to-r from-emerald-500 via-teal-500 to-cyan-400" />

          {/* Modal Header */}
          <div className="shrink-0 flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-[#222222] bg-slate-50/50 dark:bg-[#181818]/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Active Shares
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Folders currently being shared or imported
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl transition-colors hover:bg-slate-100 dark:hover:bg-[#252525]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 scrollbar-thin">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs font-medium text-slate-500 mt-4">Loading active shares...</p>
              </div>
            ) : shares.length > 0 ? (
              <div className="space-y-4">
                {shares.map((share) => (
                  <ActiveShareCard key={share.share_code} share={share} onShowToast={onShowToast} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 rounded-full bg-slate-100 dark:bg-[#222] mb-4">
                  <AlertCircle className="w-8 h-8 text-slate-400" />
                </div>
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">No active shares found</h4>
                <p className="text-xs text-slate-500 mt-2 max-w-[250px]">
                  You are not currently sharing or importing any active folders.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 flex items-center justify-end px-5 sm:px-6 py-3.5 bg-slate-50/80 dark:bg-[#181818]/80 border-t border-slate-100 dark:border-[#222222]">
            <button
              onClick={onClose}
              className="px-5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-[#282828] rounded-xl transition-colors active:scale-95"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
