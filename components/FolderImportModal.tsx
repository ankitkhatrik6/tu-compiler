"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  X,
  Download,
  FolderDown,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Camera,
  CameraOff,
  Folder,
  FileCode,
  Clock,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface FolderImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCode?: string;
  onImportSuccess: (
    items: Array<{
      id: string;
      name: string;
      type: "file" | "folder";
      parentId: string | null;
      content?: string;
    }>,
    folderName: string
  ) => void;
  onShowToast: (msg: string) => void;
}

export const FolderImportModal: React.FC<FolderImportModalProps> = ({
  isOpen,
  onClose,
  initialCode = "",
  onImportSuccess,
  onShowToast,
}) => {
  const [code, setCode] = useState<string>("");
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [preview, setPreview] = useState<{
    folderName: string;
    items: Array<{ id: string; name: string; type: "file" | "folder" }>;
    expiresAt?: string;
  } | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // QR Scanner States
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const qrRegionId = "qr-reader-container";

  // Verify share code with server
  const verifyShareCode = useCallback(async (codeToVerify: string) => {
    const cleanCode = codeToVerify.trim().toUpperCase();
    if (cleanCode.length !== 6) {
      setPreview(null);
      setErrorMsg("Share code must be exactly 6 alphanumeric characters.");
      return;
    }

    setIsVerifying(true);
    setErrorMsg(null);
    setPreview(null);

    try {
      const res = await fetch(`/api/folders/share/${cleanCode}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setPreview({
          folderName: data.folderName,
          items: data.items,
          expiresAt: data.expiresAt,
        });
      } else {
        setErrorMsg(data.error || "Invalid or expired share code.");
      }
    } catch (err) {
      console.error("Verification error:", err);
      setErrorMsg("Failed to connect to share server. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  }, []);

  // Stop QR Scanner safely
  const stopQrScanner = useCallback(async () => {
    if (html5QrcodeRef.current && html5QrcodeRef.current.isScanning) {
      try {
        await html5QrcodeRef.current.stop();
        html5QrcodeRef.current.clear();
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
    }
  }, []);

  const handleStopScanner = async () => {
    await stopQrScanner();
    setIsScanning(false);
  };

  const handleClose = () => {
    handleStopScanner();
    setCode("");
    setPreview(null);
    setErrorMsg(null);
    onClose();
  };

  // Synchronize initialCode on prop change during render
  const [prevInitialCode, setPrevInitialCode] = useState(initialCode);
  if (initialCode !== prevInitialCode) {
    setPrevInitialCode(initialCode);
    if (initialCode) {
      const clean = initialCode.trim().toUpperCase();
      setCode(clean);
    }
  }

  // Trigger verification when initialCode is 6 characters
  useEffect(() => {
    if (isOpen && initialCode) {
      const clean = initialCode.trim().toUpperCase();
      if (clean.length === 6) {
        const timer = setTimeout(() => {
          verifyShareCode(clean);
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, initialCode, verifyShareCode]);

  // Stop QR scanner on unmount
  useEffect(() => {
    return () => {
      stopQrScanner();
    };
  }, [stopQrScanner]);

  // Compute time remaining for expiration
  useEffect(() => {
    if (!preview?.expiresAt) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const exp = new Date(preview.expiresAt!).getTime();
      const distance = exp - now;

      if (distance <= 0) {
        setTimeRemaining("Expired");
        return;
      }

      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      
      setTimeRemaining(`${hours}h ${minutes}m`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // update every minute

    return () => clearInterval(interval);
  }, [preview?.expiresAt]);

  // Start HTML5 QR Code scanner with camera permission request & fallback
  const startQrScanner = async () => {
    setIsScanning(true);
    setCameraError(null);

    // Give DOM time to render canvas region
    setTimeout(async () => {
      try {
        if (!html5QrcodeRef.current) {
          html5QrcodeRef.current = new Html5Qrcode(qrRegionId);
        }

        const qrCodeSuccessCallback = (decodedText: string) => {
          let extractedCode = decodedText.trim();
          if (extractedCode.includes("share=")) {
            const match = extractedCode.match(/share=([A-Za-z0-9]{6})/);
            if (match && match[1]) {
              extractedCode = match[1];
            }
          } else if (extractedCode.includes("/folder/share/")) {
            const parts = extractedCode.split("/");
            const last = parts[parts.length - 1];
            if (last.length === 6) extractedCode = last;
          }

          extractedCode = extractedCode.toUpperCase();
          if (extractedCode.length === 6) {
            setCode(extractedCode);
            handleStopScanner();
            verifyShareCode(extractedCode);
            onShowToast(`Scanned code: ${extractedCode}`);
          }
        };

        const config = { fps: 10, qrbox: { width: 220, height: 220 } };

        // Attempt 1: Facing mode environment (rear camera on mobile)
        try {
          await html5QrcodeRef.current.start(
            { facingMode: "environment" },
            config,
            qrCodeSuccessCallback,
            () => {}
          );
          return;
        } catch {
          // Attempt 2: Facing mode user (webcam on laptop/tablet)
          try {
            await html5QrcodeRef.current.start(
              { facingMode: "user" },
              config,
              qrCodeSuccessCallback,
              () => {}
            );
            return;
          } catch {
            // Attempt 3: List available cameras and pick the first one
            const devices = await Html5Qrcode.getCameras();
            if (devices && devices.length > 0) {
              await html5QrcodeRef.current.start(
                devices[0].id,
                config,
                qrCodeSuccessCallback,
                () => {}
              );
              return;
            }
            throw new Error("No camera found on this device.");
          }
        }
      } catch (err) {
        console.error("Camera access error:", err);
        const errString = String(err);
        if (errString.includes("NotAllowedError") || errString.includes("Permission denied")) {
          setCameraError("Camera permission was denied. Please allow camera access in your browser settings or try opening the app in a new tab.");
        } else {
          setCameraError("Unable to access camera. Please check your camera connection or browser permissions.");
        }
        setIsScanning(false);
      }
    }, 150);
  };

  // Handle Input Code Change
  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6);
    setCode(val);
    setErrorMsg(null);
    if (val.length === 6) {
      verifyShareCode(val);
    } else {
      setPreview(null);
    }
  };

  // Execute Import
  const handleImport = async () => {
    if (code.length !== 6 || isImporting) return;
    setIsImporting(true);

    try {
      const res = await fetch(`/api/folders/share/${code}`, {
        method: "POST",
      });
      const data = await res.json();

      if (res.ok && data.success) {
        onImportSuccess(data.items, data.importedFolderName);
        onShowToast(`Successfully imported "${data.importedFolderName}"!`);
        onClose();
      } else {
        setErrorMsg(data.error || "Failed to import folder.");
      }
    } catch (err) {
      console.error("Import error:", err);
      setErrorMsg("Failed to complete import. Please check your connection.");
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

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
          {/* Accent Line */}
          <div className="h-1 w-full bg-linear-to-r from-emerald-500 via-teal-500 to-cyan-400" />

          {/* Header */}
          <div className="shrink-0 flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-[#222222] bg-slate-50/50 dark:bg-[#181818]/50">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                <FolderDown className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                  Import Shared Folder
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  Enter 6-digit code or scan QR code
                </p>
              </div>
            </div>

            <button
              onClick={handleClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl transition-colors hover:bg-slate-100 dark:hover:bg-[#252525] shrink-0"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 scrollbar-thin">
            {/* Input & QR trigger */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  6-Digit Share Code
                </label>

                {!isScanning ? (
                  <button
                    onClick={startQrScanner}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Scan QR Code</span>
                  </button>
                ) : (
                  <button
                    onClick={handleStopScanner}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                  >
                    <CameraOff className="w-3.5 h-3.5" />
                    <span>Close Camera</span>
                  </button>
                )}
              </div>

              <div className="relative flex items-center">
                <input
                  type="text"
                  maxLength={6}
                  value={code}
                  onChange={handleCodeChange}
                  placeholder="e.g. A8K9ZP"
                  className="w-full px-4 py-3 font-mono text-2xl font-black tracking-[0.2em] text-center uppercase bg-slate-50 dark:bg-[#1A1A1A] text-slate-900 dark:text-white border border-slate-200 dark:border-[#2A2A2A] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50 shadow-xs"
                />

                {isVerifying && (
                  <div className="absolute right-4">
                    <RefreshCw className="w-5 h-5 text-emerald-500 animate-spin" />
                  </div>
                )}
              </div>
            </div>

            {/* Camera View for QR Scan */}
            {isScanning && (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center space-y-2">
                <div id={qrRegionId} className="w-full max-w-[280px] overflow-hidden rounded-xl"></div>
                <p className="text-[11px] text-slate-400 text-center">
                  Position the QR code inside the frame to scan automatically
                </p>
              </div>
            )}

            {cameraError && (
              <div className="p-3.5 text-xs text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{cameraError}</span>
              </div>
            )}

            {errorMsg && (
              <div className="p-3.5 text-xs text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Folder Preview card */}
            {preview && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 sm:p-5 rounded-2xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 space-y-3"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                        Folder Verified & Ready
                      </span>
                      {timeRemaining && timeRemaining !== "Expired" && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <Clock className="w-3 h-3" />
                          {timeRemaining}
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {preview.folderName}
                    </h4>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-emerald-500/15 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>{preview.items.filter((i) => i.type === "folder").length} Subfolders</span>
                  </span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <FileCode className="w-4 h-4 text-blue-500 shrink-0" />
                    <span>{preview.items.filter((i) => i.type === "file").length} Files</span>
                  </span>
                </div>
              </motion.div>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 flex items-center justify-end gap-3 px-5 sm:px-6 py-3.5 bg-slate-50/80 dark:bg-[#181818]/80 border-t border-slate-100 dark:border-[#222222]">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-[#282828] rounded-xl transition-colors active:scale-95"
            >
              Cancel
            </button>

            <button
              onClick={handleImport}
              disabled={!preview || isImporting || code.length !== 6}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-md shadow-emerald-500/10 transition-all active:scale-[0.98]"
            >
              {isImporting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Import Folder</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
