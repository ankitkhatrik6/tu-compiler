"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import {
  X,
  Copy,
  Check,
  RefreshCw,
  QrCode,
  Share2,
  Lock,
  ShieldCheck,
  Sparkles,
  Link2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface FolderShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderId: string;
  folderName: string;
  folderItems: Array<{
    id: string;
    name: string;
    type: "file" | "folder";
    parentId: string | null;
    content?: string;
  }>;
  onShowToast: (msg: string) => void;
}

export const FolderShareModal: React.FC<FolderShareModalProps> = ({
  isOpen,
  onClose,
  folderId,
  folderName,
  folderItems,
  onShowToast,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [isToggling, setIsToggling] = useState<boolean>(false);

  // Compute share link URL
  const shareLink =
    typeof window !== "undefined" && shareCode
      ? `${window.location.origin}/?share=${shareCode}`
      : "";

  const initializedFolderRef = useRef<string | null>(null);

  // Initialize or fetch share code when modal opens for a folder
  useEffect(() => {
    if (!isOpen) {
      initializedFolderRef.current = null;
      return;
    }

    if (!folderId || initializedFolderRef.current === folderId) return;

    initializedFolderRef.current = folderId;
    let isMounted = true;

    const initShare = async () => {
      setLoading(true);
      try {
        // Collect all items inside this folder recursively
        const collectedItemIds = new Set<string>([folderId]);
        let added = true;
        while (added) {
          added = false;
          for (const item of folderItems) {
            if (
              item.parentId &&
              collectedItemIds.has(item.parentId) &&
              !collectedItemIds.has(item.id)
            ) {
              collectedItemIds.add(item.id);
              added = true;
            }
          }
        }

        const itemsToShare = folderItems.filter((item) =>
          collectedItemIds.has(item.id)
        );

        const res = await fetch("/api/folders/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            folderId,
            folderName,
            items: itemsToShare,
          }),
        });

        const data = await res.json();
        if (data.success && isMounted) {
          setShareCode(data.shareCode);
          setIsActive(data.is_active ?? true);
        } else if (data.error && isMounted) {
          onShowToast(`Error: ${data.error}`);
        }
      } catch (err) {
        console.error("Failed to initialize folder share:", err);
        if (isMounted) onShowToast("Failed to initialize share code.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initShare();

    return () => {
      isMounted = false;
    };
  }, [isOpen, folderId, folderName, folderItems, onShowToast]);

  // Generate QR Code data URL whenever shareLink changes
  useEffect(() => {
    if (!shareLink) return;

    QRCode.toDataURL(shareLink, {
      width: 320,
      margin: 2,
      color: {
        dark: "#0F172A",
        light: "#FFFFFF",
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error("QR Code generation error:", err));
  }, [shareLink]);

  if (!isOpen) return null;

  // Copy share link to clipboard
  const handleCopyLink = () => {
    if (!shareLink) return;
    navigator.clipboard.writeText(shareLink);
    setCopiedLink(true);
    onShowToast("Share link copied to clipboard!");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Copy share code to clipboard
  const handleCopyCode = () => {
    if (!shareCode) return;
    navigator.clipboard.writeText(shareCode);
    setCopiedCode(true);
    onShowToast("Share code copied to clipboard!");
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Regenerate Share Code
  const handleRegenerate = async () => {
    if (!folderId || isRegenerating) return;
    setIsRegenerating(true);
    try {
      const collectedItemIds = new Set<string>([folderId]);
      let added = true;
      while (added) {
        added = false;
        for (const item of folderItems) {
          if (
            item.parentId &&
            collectedItemIds.has(item.parentId) &&
            !collectedItemIds.has(item.id)
          ) {
            collectedItemIds.add(item.id);
            added = true;
          }
        }
      }

      const itemsToShare = folderItems.filter((item) =>
        collectedItemIds.has(item.id)
      );

      const res = await fetch("/api/folders/share", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderId,
          folderName,
          items: itemsToShare,
          oldCode: shareCode,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShareCode(data.shareCode);
        setIsActive(true);
        onShowToast(`New share code generated: ${data.shareCode}`);
      } else {
        onShowToast(`Failed: ${data.error || "Could not regenerate code"}`);
      }
    } catch (err) {
      console.error("Regenerate error:", err);
      onShowToast("Failed to regenerate share code.");
    } finally {
      setIsRegenerating(false);
    }
  };

  // Toggle Sharing Disable/Enable
  const handleToggleActive = async () => {
    if (!shareCode || isToggling) return;
    setIsToggling(true);
    const newStatus = !isActive;
    try {
      const res = await fetch("/api/folders/share", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderId,
          shareCode,
          isActive: newStatus,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setIsActive(newStatus);
        onShowToast(newStatus ? "Folder sharing enabled!" : "Folder sharing disabled.");
      } else {
        onShowToast(`Failed: ${data.error}`);
      }
    } catch (err) {
      console.error("Toggle share status error:", err);
      onShowToast("Failed to update share status.");
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/70 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative flex flex-col w-full max-w-lg max-h-[90vh] overflow-hidden bg-white dark:bg-[#141414] border border-slate-200/80 dark:border-[#282828] rounded-2xl shadow-2xl"
        >
          {/* Top Accent Line */}
          <div className="h-1 w-full bg-linear-to-r from-blue-500 via-indigo-500 to-cyan-400" />

          {/* Modal Header */}
          <div className="shrink-0 flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-[#222222] bg-slate-50/50 dark:bg-[#181818]/50">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                <Share2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                    Share Folder
                  </h3>
                  <span className="hidden sm:inline-flex items-center px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 rounded-full border border-blue-500/20">
                    Live Sync
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[220px] sm:max-w-[300px]">
                  {folderName}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl transition-colors hover:bg-slate-100 dark:hover:bg-[#252525] shrink-0"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body - Scrollable */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 scrollbar-thin">
            {/* Status & Control Pill */}
            <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200/70 dark:border-[#2A2A2A]">
              <div className="flex items-center gap-2.5 min-w-0">
                {isActive ? (
                  <>
                    <span className="relative flex w-2.5 h-2.5 shrink-0">
                      <span className="absolute inline-flex w-full h-full rounded-full opacity-75 animate-ping bg-emerald-400"></span>
                      <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    </span>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 block truncate">
                        Sharing Active
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 hidden sm:block">
                        Anyone with link can import
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400 dark:bg-slate-500 shrink-0"></span>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block truncate">
                        Sharing Disabled
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 hidden sm:block">
                        Access blocked for this code
                      </span>
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={handleToggleActive}
                disabled={isToggling || loading || !shareCode}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shrink-0 active:scale-[0.98] ${
                  isActive
                    ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                    : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                } disabled:opacity-50`}
              >
                {isToggling ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : isActive ? (
                  "Disable Access"
                ) : (
                  "Enable Access"
                )}
              </button>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Generating secure share code...
                </p>
              </div>
            ) : shareCode ? (
              <>
                {/* QR Code & Share Code Card */}
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200/70 dark:border-[#2A2A2A] space-y-4">
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5">
                    {/* QR Display */}
                    <div className="relative p-2.5 bg-white rounded-xl shadow-xs border border-slate-200 dark:border-slate-300 shrink-0">
                      {qrDataUrl ? (
                        <Image
                          src={qrDataUrl}
                          alt="Folder Share QR Code"
                          width={128}
                          height={128}
                          unoptimized
                          referrerPolicy="no-referrer"
                          className={`w-28 h-28 sm:w-32 sm:h-32 rounded-lg transition-all duration-200 ${
                            isActive ? "opacity-100" : "opacity-25 blur-[1px]"
                          }`}
                        />
                      ) : (
                        <div className="w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center bg-slate-100">
                          <QrCode className="w-8 h-8 text-slate-400 animate-pulse" />
                        </div>
                      )}
                      {!isActive && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
                          <Lock className="w-7 h-7 text-white drop-shadow-md" />
                        </div>
                      )}
                    </div>

                    {/* Code & Copy Controls */}
                    <div className="flex-1 w-full text-center sm:text-left space-y-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          6-Digit Share Code
                        </span>
                        <div className="flex items-center justify-center sm:justify-start gap-2 mt-1">
                          <div className="px-4 py-2 font-mono text-2xl font-black tracking-widest text-blue-600 dark:text-blue-400 bg-blue-500/10 rounded-xl border border-blue-500/20 shadow-xs">
                            {shareCode}
                          </div>
                          <button
                            onClick={handleCopyCode}
                            disabled={!isActive}
                            className="p-2.5 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-200/70 dark:hover:bg-[#282828] rounded-xl transition-all disabled:opacity-40 active:scale-95"
                            title="Copy Code"
                            aria-label="Copy code"
                          >
                            {copiedCode ? (
                              <Check className="w-5 h-5 text-emerald-500" />
                            ) : (
                              <Copy className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="pt-1 flex items-center justify-center sm:justify-start">
                        <button
                          onClick={handleRegenerate}
                          disabled={isRegenerating || loading}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors disabled:opacity-50"
                        >
                          <RefreshCw
                            className={`w-3.5 h-3.5 ${
                              isRegenerating ? "animate-spin text-blue-500" : ""
                            }`}
                          />
                          <span>Regenerate new code</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Direct Link Section */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-blue-500" />
                      Direct Share Link
                    </label>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                      Auto-imports on click
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={shareLink}
                      className="flex-1 min-w-0 px-3.5 py-2.5 text-xs font-mono bg-slate-50 dark:bg-[#1A1A1A] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-[#2A2A2A] rounded-xl focus:outline-hidden select-all truncate"
                    />
                    <button
                      onClick={handleCopyLink}
                      disabled={!isActive}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all disabled:opacity-50 shadow-md shadow-blue-500/10 shrink-0 active:scale-[0.98]"
                    >
                      {copiedLink ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Security Note */}
                <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/15 text-xs text-slate-600 dark:text-slate-300">
                  <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Anyone with this 6-character code or QR link can instantly import a copy of this folder. Imported files run independently in their own workspace.
                  </p>
                </div>
              </>
            ) : null}
          </div>

          {/* Modal Footer */}
          <div className="shrink-0 flex items-center justify-end px-5 sm:px-6 py-3.5 bg-slate-50/80 dark:bg-[#181818]/80 border-t border-slate-100 dark:border-[#222222]">
            <button
              onClick={onClose}
              className="px-5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-[#282828] rounded-xl transition-colors active:scale-95"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
