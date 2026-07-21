"use client";

import React, { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  Plus,
  FolderPlus,
  FilePlus,
  Trash2,
  Edit3,
  Play,
  Terminal as TerminalIcon,
  Download,
  X,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  Check,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useIsMobile } from "@/hooks/use-mobile";

// Virtual File System Item Schema
interface FSItem {
  id: string;
  name: string;
  type: "file" | "folder";
  parentId: string | null;
  content?: string; // only for files
}

// Terminal Log Segment Schema
interface TerminalLog {
  type: "command" | "compile-success" | "compile-error" | "program-output" | "system" | "exit-status";
  text: string;
  path?: string;
}

// Default Seed File System
const DEFAULT_FS: FSItem[] = [
  {
    id: "folder-1",
    name: "Lab-1",
    type: "folder",
    parentId: null,
  },
  {
    id: "file-1",
    name: "main.cpp",
    type: "file",
    parentId: "folder-1",
    content: `#include <iostream>
#include <iomanip>
#include <string>

using namespace std;

int main() {
    int type;
    double basicSalary, netSalary;

    cout << "Enter employee type (1-Permanent, 2-Contract): ";
    if (!(cin >> type)) {
        cout << "\\nInvalid employee type input!" << endl;
        return 1;
    }

    cout << "Enter basic salary: ";
    if (!(cin >> basicSalary)) {
        cout << "\\nInvalid basic salary input!" << endl;
        return 1;
    }

    if (type == 1) {
        netSalary = basicSalary * 1.10; // 10% bonus for permanent
    } else if (type == 2) {
        netSalary = basicSalary * 1.05; // 5% bonus for contract
    } else {
        cout << "\\nUnknown employee type selected!" << endl;
        return 1;
    }

    cout << "\\n====================================\\n";
    cout << "Employee Type : " << (type == 1 ? "Permanent" : "Contract") << "\\n";
    cout << "Basic Salary  : " << fixed << setprecision(2) << basicSalary << "\\n";
    cout << "Net Salary    : " << fixed << setprecision(2) << netSalary << "\\n";
    cout << "====================================\\n";

    return 0;
}
`,
  },
  {
    id: "file-2",
    name: "README.md",
    type: "file",
    parentId: "folder-1",
    content: `# Lab 1: Employee Salary Calculator

This is a simple C++ console program to calculate net salary based on the basic salary and employee type.

## Project Structure
- \`main.cpp\`: Source code for the salary calculator.

## Instructions
1. Select \`main.cpp\` in the folder explorer.
2. Click the green **Run** button.
3. Enter inputs in the integrated terminal.
4. Export the final terminal output as a screenshot image using the **Save Output** button.
`,
  },
  {
    id: "folder-2",
    name: "Lab-2",
    type: "folder",
    parentId: null,
  },
  {
    id: "file-3",
    name: "converter.cpp",
    type: "file",
    parentId: "folder-2",
    content: `#include <iostream>

using namespace std;

int main() {
    int choice;
    double temp, converted;

    cout << "--- Temperature Converter ---\\n";
    cout << "1. Fahrenheit to Celsius\\n";
    cout << "2. Celsius to Fahrenheit\\n";
    cout << "Choose option (1-2): ";
    if (!(cin >> choice)) return 1;

    cout << "Enter temperature value: ";
    if (!(cin >> temp)) return 1;

    if (choice == 1) {
        converted = (temp - 32) * 5.0 / 9.0;
        cout << temp << " F is equal to " << converted << " C\\n";
    } else if (choice == 2) {
        converted = (temp * 9.0 / 5.0) + 32;
        cout << temp << " C is equal to " << converted << " F\\n";
    } else {
        cout << "Invalid conversion option selected.\\n";
    }

    return 0;
}
`,
  },
  {
    id: "folder-3",
    name: "Lab-3",
    type: "folder",
    parentId: null,
  },
  {
    id: "file-4",
    name: "sorting.c",
    type: "file",
    parentId: "folder-3",
    content: `#include <stdio.h>

void bubbleSort(int arr[], int n) {
    for (int i = 0; i < n - 1; i++) {
        for (int j = 0; j < n - i - 1; j++) {
            if (arr[j] > arr[j + 1]) {
                int temp = arr[j];
                arr[j] = arr[j + 1];
                arr[j + 1] = temp;
            }
        }
    }
}

int main() {
    int arr[5];
    printf("Enter 5 integers to sort:\\n");
    for (int i = 0; i < 5; i++) {
        printf("Value %d: ", i + 1);
        if (scanf("%d", &arr[i]) != 1) {
            printf("Invalid integer input!\\n");
            return 1;
        }
    }

    bubbleSort(arr, 5);

    printf("\\nSorted array in ascending order:\\n[ ");
    for (int i = 0; i < 5; i++) {
        printf("%d ", arr[i]);
    }
    printf("]\\n");

    return 0;
}
`,
  },
];

export default function IDEPage() {
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);

  // Terminal Username and Hostname Customization with Local Storage persistence
  const [terminalUser, setTerminalUser] = useState<string>("ankit");
  const [terminalHost, setTerminalHost] = useState<string>("cppide");
  const [showTerminalConfig, setShowTerminalConfig] = useState(false);

  // Custom Delete and Alert Dialog States for sandboxed iframe safety
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    itemId: string | null;
    itemName: string;
    itemType: "file" | "folder";
  }>({
    isOpen: false,
    itemId: null,
    itemName: "",
    itemType: "file",
  });

  const [customAlert, setCustomAlert] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({
    isOpen: false,
    title: "",
    message: "",
  });

  // VFS States (Lazy initialized to satisfy strict React hook ESLint rules)
  const [fs, setFs] = useState<FSItem[]>(DEFAULT_FS);
  const [activeFileId, setActiveFileId] = useState<string | null>("file-1");
  const [openTabs, setOpenTabs] = useState<string[]>(["file-1"]);

  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    "folder-1": true,
    "folder-2": false,
    "folder-3": false,
  });

  // UI Management States
  const [activeMobileTab, setActiveMobileTab] = useState<"explorer" | "editor" | "terminal">("editor");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [creatorInput, setCreatorInput] = useState<{
    visible: boolean;
    type: "file" | "folder";
    parentId: string | null;
    value: string;
  }>({ visible: false, type: "file", parentId: null, value: "" });

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Running State / Terminal State
  const [terminalLogs, setTerminalLogs] = useState<TerminalLog[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [inputs, setInputs] = useState<string[]>([]);
  const [currentInputVal, setCurrentInputVal] = useState("");
  const [executionState, setExecutionState] = useState<{
    status: "idle" | "running" | "waiting_for_input" | "exited" | "compile_error" | "runtime_error";
    output: string;
    executionTime?: number;
    exitCode?: number;
    promptedInputVar?: string;
  }>({ status: "idle", output: "" });

  const terminalInputRef = useRef<HTMLInputElement>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Safely sync settings and file systems from localStorage after client-side mount (avoids hydration mismatches)
  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
      
      const savedUser = localStorage.getItem("cpp_ide_user");
      if (savedUser) setTerminalUser(savedUser);
      
      const savedHost = localStorage.getItem("cpp_ide_host");
      if (savedHost) setTerminalHost(savedHost);

      const savedFs = localStorage.getItem("cpp_ide_fs");
      if (savedFs) {
        try {
          const parsed = JSON.parse(savedFs);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setFs(parsed);
            const firstFile = parsed.find((item: any) => item.type === "file");
            if (firstFile) {
              setActiveFileId(firstFile.id);
              setOpenTabs([firstFile.id]);
            } else {
              setActiveFileId(null);
              setOpenTabs([]);
            }
          }
        } catch (e) {
          console.error("Failed to parse saved FS", e);
        }
      } else {
        localStorage.setItem("cpp_ide_fs", JSON.stringify(DEFAULT_FS));
      }
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  // Save VFS changes to local storage
  const saveFsToLocalStorage = (newFs: FSItem[]) => {
    setFs(newFs);
    localStorage.setItem("cpp_ide_fs", JSON.stringify(newFs));
  };

  // Get active file
  const activeFile = fs.find((item) => item.id === activeFileId && item.type === "file");

  // Get parent folder path of a file recursively
  const getParentFolderPath = (item: FSItem): string => {
    if (!item.parentId) return "";
    const pathParts: string[] = [];
    let currentId = item.parentId;
    const visited = new Set<string>();
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const parent = fs.find((p) => p.id === currentId);
      if (!parent) break;
      pathParts.unshift(parent.name);
      currentId = parent.parentId || "";
    }
    return pathParts.join("/");
  };

  // Get full item path of a file or folder (including its own name)
  const getItemFullPath = (item: FSItem): string => {
    const pathParts: string[] = [item.name];
    let currentId = item.parentId;
    const visited = new Set<string>();
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const parent = fs.find((p) => p.id === currentId);
      if (!parent) break;
      pathParts.unshift(parent.name);
      currentId = parent.parentId || "";
    }
    return pathParts.join("/");
  };

  // Auto-scroll terminal to bottom when logs or status changes
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
    if (executionState.status === "waiting_for_input") {
      terminalInputRef.current?.focus();
    }
  }, [terminalLogs, executionState.status]);

  // Handle clicking anywhere in terminal to focus the active prompt input
  const handleTerminalClick = () => {
    if (executionState.status === "waiting_for_input") {
      terminalInputRef.current?.focus();
    }
  };

  // VFS: File Creation
  const handleCreateItem = (e: React.FormEvent) => {
    e.preventDefault();
    const name = creatorInput.value.trim();
    if (!name) return;

    // Default extension for file if missing
    let finalName = name;
    if (creatorInput.type === "file" && !name.includes(".")) {
      finalName = `${name}.cpp`;
    }

    // Check duplicate
    const duplicate = fs.find(
      (item) =>
        item.parentId === creatorInput.parentId &&
        item.name.toLowerCase() === finalName.toLowerCase() &&
        item.type === creatorInput.type
    );

    if (duplicate) {
      setCustomAlert({
        isOpen: true,
        title: "Duplicate Item",
        message: `A ${creatorInput.type} named "${finalName}" already exists in this directory.`
      });
      return;
    }

    const newItem: FSItem = {
      id: `item-${Date.now()}`,
      name: finalName,
      type: creatorInput.type,
      parentId: creatorInput.parentId,
      ...(creatorInput.type === "file" ? { content: creatorInput.value.endsWith(".md") ? "# New Markdown File" : `// New ${finalName} program\n#include <iostream>\n\nint main() {\n    std::cout << "Hello!" << std::endl;\n    return 0;\n}\n` } : {}),
    };

    const newFs = [...fs, newItem];
    saveFsToLocalStorage(newFs);

    if (newItem.type === "file") {
      setActiveFileId(newItem.id);
      if (!openTabs.includes(newItem.id)) {
        setOpenTabs([...openTabs, newItem.id]);
      }
      if (isMobile) {
        setActiveMobileTab("editor");
      }
    }

    setCreatorInput({ visible: false, type: "file", parentId: null, value: "" });
  };

  // VFS: Rename
  const handleRename = (e: React.FormEvent) => {
    e.preventDefault();
    const name = renameValue.trim();
    if (!name || !renamingId) return;

    const currentItem = fs.find((item) => item.id === renamingId);
    if (!currentItem) return;

    // Maintain extension if user deleted it
    let finalName = name;
    if (currentItem.type === "file" && currentItem.name.includes(".") && !name.includes(".")) {
      const ext = currentItem.name.split(".").pop();
      finalName = `${name}.${ext}`;
    }

    const newFs = fs.map((item) => {
      if (item.id === renamingId) {
        return { ...item, name: finalName };
      }
      return item;
    });

    saveFsToLocalStorage(newFs);
    setRenamingId(null);
    setRenameValue("");
  };

  // VFS: Delete (shows custom overlay modal instead of blocked window.confirm)
  const handleDeleteItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const item = fs.find((i) => i.id === id);
    if (!item) return;

    setDeleteConfirmation({
      isOpen: true,
      itemId: id,
      itemName: item.name,
      itemType: item.type,
    });
  };

  // VFS: Confirmed deletion execution
  const executeDeleteItem = (id: string) => {
    const item = fs.find((i) => i.id === id);
    if (!item) return;

    // Recursively collect all ids to delete
    const getIdsToDelete = (parentId: string): string[] => {
      const children = fs.filter((i) => i.parentId === parentId);
      let ids = children.map((c) => c.id);
      children.forEach((c) => {
        if (c.type === "folder") {
          ids = [...ids, ...getIdsToDelete(c.id)];
        }
      });
      return ids;
    };

    const idsToDelete = [id, ...(item.type === "folder" ? getIdsToDelete(id) : [])];
    const newFs = fs.filter((i) => !idsToDelete.includes(i.id));

    saveFsToLocalStorage(newFs);

    // Clean up tabs
    const filteredTabs = openTabs.filter((tId) => !idsToDelete.includes(tId));
    setOpenTabs(filteredTabs);

    if (activeFileId && idsToDelete.includes(activeFileId)) {
      if (filteredTabs.length > 0) {
        setActiveFileId(filteredTabs[0]);
      } else {
        const remainingFiles = newFs.filter((i) => i.type === "file");
        if (remainingFiles.length > 0) {
          setActiveFileId(remainingFiles[0].id);
          setOpenTabs([remainingFiles[0].id]);
        } else {
          setActiveFileId(null);
        }
      }
    }

    setDeleteConfirmation({
      isOpen: false,
      itemId: null,
      itemName: "",
      itemType: "file",
    });
  };

  // Editor Content Change Helper
  const handleEditorChange = (value: string | undefined) => {
    if (!activeFileId) return;
    const newFs = fs.map((item) => {
      if (item.id === activeFileId) {
        return { ...item, content: value || "" };
      }
      return item;
    });
    saveFsToLocalStorage(newFs);
  };

  // Compile & Execution Trigger
  const triggerRunProgram = async (accumulatedInputs: string[] = []) => {
    if (!activeFile) return;
    setIsRunning(true);

    const folderName = getParentFolderPath(activeFile);
    const isCpp = activeFile.name.endsWith(".cpp") || activeFile.name.endsWith(".hpp") || activeFile.name.endsWith(".cc");
    const fileBaseName = activeFile.name.substring(0, activeFile.name.lastIndexOf('.')) || activeFile.name;
    const compileCmd = isCpp ? `g++ ${activeFile.name} -o ${fileBaseName}` : `gcc ${activeFile.name} -o ${fileBaseName}`;

    if (accumulatedInputs.length === 0) {
      // Starting fresh run: clear previous outputs & print initial command log
      setInputs([]);
      setExecutionState({ status: "running", output: "" });

      setTerminalLogs([
        {
          type: "command",
          text: compileCmd,
          path: folderName || undefined,
        },
      ]);

      if (isMobile) {
        setActiveMobileTab("terminal");
      }
    }

    try {
      const response = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: activeFile.name,
          code: activeFile.content || "",
          inputs: accumulatedInputs,
          files: fs
            .filter((item) => item.type === "file")
            .map((item) => ({
              name: item.name,
              content: item.content || "",
            })),
        }),
      });

      const data = await response.json();

      const newLogs: TerminalLog[] = [
        {
          type: "command",
          text: compileCmd,
          path: folderName || undefined,
        },
      ];

      if (!data.compiled) {
        newLogs.push({
          type: "compile-error",
          text: data.compileErrors,
        });
        newLogs.push({
          type: "exit-status",
          text: "\nCompilation failed.",
        });
        setTerminalLogs(newLogs);
        setExecutionState({
          status: "compile_error",
          output: data.compileErrors,
        });
        setIsRunning(false);
        return;
      }

      // Compiled successfully!
      newLogs.push({
        type: "compile-success",
        text: "\nCompilation successful.\n",
      });

      newLogs.push({
        type: "command",
        text: `./${fileBaseName}`,
        path: folderName || undefined,
      });

      // Show program output
      if (data.output) {
        newLogs.push({
          type: "program-output",
          text: data.output,
        });
      }

      if (data.status === "waiting_for_input") {
        setTerminalLogs(newLogs);
        setExecutionState({
          status: "waiting_for_input",
          output: data.output,
          promptedInputVar: data.promptedInputVar,
        });
      } else if (data.status === "runtime_error") {
        newLogs.push({
          type: "compile-error",
          text: `\nRuntime Error: ${data.runtimeError}`,
        });
        setTerminalLogs(newLogs);
        setExecutionState({
          status: "runtime_error",
          output: data.output,
        });
      } else {
        // Exited normally
        newLogs.push({
          type: "exit-status",
          text: `\nProgram exited with code ${data.exitCode ?? 0}\nExecution time: ${(data.executionTime ?? 0.003).toFixed(3)} s\n`,
        });
        setTerminalLogs(newLogs);
        setExecutionState({
          status: "exited",
          output: data.output,
          executionTime: data.executionTime,
          exitCode: data.exitCode,
        });
      }
    } catch (err: any) {
      console.error(err);
      setTerminalLogs((prev) => [
        ...prev,
        {
          type: "compile-error",
          text: "\nIDE Error: Failed to execute build request in environment.",
        },
      ]);
      setExecutionState({ status: "runtime_error", output: "An internal communication error occurred." });
    } finally {
      setIsRunning(false);
    }
  };

  // Handle submitting user input in terminal
  const handleTerminalInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInputVal.trim() && currentInputVal === "") return;

    const updatedInputs = [...inputs, currentInputVal];
    setInputs(updatedInputs);
    setCurrentInputVal("");

    // Trigger run with updated inputs
    triggerRunProgram(updatedInputs);
  };

  // Export terminal logs as perfect image
  const handleExportTerminalImage = () => {
    if (terminalLogs.length === 0) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Gather text representations of terminal logs
    const linesToDraw: { text: string; color: string; indent?: number }[] = [];

    terminalLogs.forEach((log) => {
      if (log.type === "command") {
        const pathPart = log.path ? `~/${log.path}` : "~";
        linesToDraw.push({
          text: `${terminalUser}@${terminalHost}:${pathPart}$ ${log.text}`,
          color: "#4ade80", // bright green prompt start
        });
      } else if (log.type === "compile-success") {
        linesToDraw.push({
          text: log.text.trim(),
          color: "#34d399", // emerald green success
        });
      } else if (log.type === "compile-error") {
        // Split multicompile errors
        log.text.split("\n").forEach((l) => {
          linesToDraw.push({
            text: l,
            color: "#f87171", // soft red error
          });
        });
      } else if (log.type === "program-output") {
        log.text.split("\n").forEach((l) => {
          linesToDraw.push({
            text: l,
            color: "#cbd5e1", // neutral slate text
          });
        });
      } else if (log.type === "exit-status") {
        log.text.split("\n").forEach((l) => {
          if (l.trim()) {
            linesToDraw.push({
              text: l,
              color: "#94a3b8", // gray status
            });
          }
        });
      }
    });

    // Add trailing blank command prompt to complete the terminal screenshot
    const activeFolder = activeFile ? getParentFolderPath(activeFile) : "";
    const trailPath = activeFolder ? `~/${activeFolder}` : "~";
    linesToDraw.push({
      text: `${terminalUser}@${terminalHost}:${trailPath}$ `,
      color: "#4ade80",
    });

    // Canvas styling properties
    const paddingLeft = 24;
    const paddingRight = 24;
    const paddingTop = 28;
    const paddingBottom = 28;
    const fontSize = 14;
    const lineHeight = 22;

    // Configure monospace font and calculate canvas width/height
    ctx.font = `${fontSize}px "JetBrains Mono", "Fira Code", "Consolas", "Monaco", monospace`;
    let maxLineWidth = 600;

    // Determine absolute widest line
    linesToDraw.forEach((line) => {
      const measurement = ctx.measureText(line.text);
      if (measurement.width > maxLineWidth) {
        maxLineWidth = measurement.width;
      }
    });

    const canvasWidth = Math.min(Math.max(maxLineWidth + paddingLeft + paddingRight, 720), 1200);
    const canvasHeight = linesToDraw.length * lineHeight + paddingTop + paddingBottom;

    // High quality scaling factor (DPI / Retina rendering)
    const scale = 3;
    canvas.width = canvasWidth * scale;
    canvas.height = canvasHeight * scale;

    // Scale the 2D context to render extremely sharp, high-DPI text
    ctx.scale(scale, scale);

    // Re-apply context font and properties after canvas resize (resizing resets context)
    ctx.font = `${fontSize}px "JetBrains Mono", "Fira Code", "Consolas", "Monaco", monospace`;
    ctx.textBaseline = "top";
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Draw background
    ctx.fillStyle = "#0c0c0e"; // Dark slate terminal bg
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw solid window-like top border accent
    ctx.fillStyle = "#1e1e24";
    ctx.fillRect(0, 0, canvasWidth, 6);

    // Render lines of text
    linesToDraw.forEach((line, index) => {
      const y = paddingTop + index * lineHeight;

      // Color coding logic inside individual lines (specifically for command prompts)
      const expectedPromptPrefix = `${terminalUser}@${terminalHost}:`;
      if (line.text.startsWith(expectedPromptPrefix)) {
        const promptEndIndex = line.text.indexOf("$ ");
        if (promptEndIndex !== -1) {
          const prompt = line.text.substring(0, promptEndIndex + 2);
          const commandText = line.text.substring(promptEndIndex + 2);

          // Draw prompt part in green
          ctx.fillStyle = "#34d399";
          ctx.fillText(prompt, paddingLeft, y);

          // Calculate exact starting position for the rest of the text
          const promptWidth = ctx.measureText(prompt).width;

          // Draw command in white
          ctx.fillStyle = "#f8fafc";
          ctx.fillText(commandText, paddingLeft + promptWidth, y);
          return;
        }
      }

      // Normal line drawing
      ctx.fillStyle = line.color;
      ctx.fillText(line.text, paddingLeft, y);
    });

    // Save and download canvas as image file
    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    const folderPath = activeFile ? getParentFolderPath(activeFile) : "";
    const cleanFolderPath = folderPath ? folderPath.replace(/\//g, "_") + "_" : "";
    const baseName = (activeFile?.name || "program").replace(/\.[^/.]+$/, "");
    link.download = `${cleanFolderPath}${baseName}_tucompiler.png`;
    link.href = url;
    link.click();
  };

  // Reset Terminal View
  const handleResetTerminal = () => {
    setTerminalLogs([]);
    setInputs([]);
    setExecutionState({ status: "idle", output: "" });
  };

  // Helper to get active file tab item
  const openTabsList = openTabs
    .map((tabId) => fs.find((item) => item.id === tabId))
    .filter(Boolean) as FSItem[];

  // Recursive explorer node renderer
  const renderExplorerNode = (nodes: FSItem[], parentId: string | null = null, depth = 0) => {
    const currentNodes = nodes
      .filter((node) => node.parentId === parentId)
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    return currentNodes.map((node) => {
      const isExpanded = expandedFolders[node.id];
      const isActive = activeFileId === node.id;
      const isRenaming = renamingId === node.id;

      return (
        <div key={node.id} style={{ paddingLeft: `${depth * 12}px` }}>
          {node.type === "folder" ? (
            <div>
              {/* Folder Header */}
              <div
                onClick={() => {
                  setExpandedFolders((prev) => ({ ...prev, [node.id]: !prev[node.id] }));
                }}
                title={getItemFullPath(node)}
                className="flex items-center justify-between group py-1.5 px-2 hover:bg-[#2A2A2A] cursor-pointer select-none transition-colors border-l-2 border-transparent"
              >
                <div className="flex items-center space-x-2 text-[#666] min-w-0">
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 text-[#999]" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-[#999]" />
                  )}
                  {isExpanded ? (
                    <FolderOpen className="w-4 h-4 text-[#4A9eff] flex-shrink-0" />
                  ) : (
                    <Folder className="w-4 h-4 text-[#4A9eff] flex-shrink-0" />
                  )}

                  {isRenaming ? (
                    <form
                      onSubmit={handleRename}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center"
                    >
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="bg-[#121212] border border-[#3A3A3A] rounded text-xs px-1.5 py-0.5 text-zinc-100 outline-none w-28 font-mono"
                        autoFocus
                        onBlur={() => setRenamingId(null)}
                      />
                    </form>
                  ) : (
                    <span className="text-xs font-mono font-medium truncate text-[#CCC]">{node.name}</span>
                  )}
                </div>

                {/* Folder Actions */}
                {!isRenaming && (
                  <div className="flex items-center space-x-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0 pl-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedFolders((p) => ({ ...p, [node.id]: true }));
                        setCreatorInput({ visible: true, type: "file", parentId: node.id, value: "" });
                      }}
                      title="New File"
                      className="p-1 text-[#666] hover:text-[#CCC] hover:bg-[#2D2D2D] rounded"
                    >
                      <FilePlus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedFolders((p) => ({ ...p, [node.id]: true }));
                        setCreatorInput({ visible: true, type: "folder", parentId: node.id, value: "" });
                      }}
                      title="New Folder"
                      className="p-1 text-[#666] hover:text-[#CCC] hover:bg-[#2D2D2D] rounded"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenamingId(node.id);
                        setRenameValue(node.name);
                      }}
                      title="Rename"
                      className="p-1 text-[#666] hover:text-[#CCC] hover:bg-[#2D2D2D] rounded"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteItem(node.id, e)}
                      title="Delete"
                      className="p-1 text-red-400/70 hover:text-red-400 hover:bg-[#2D2D2D] rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Collapsed/Expanded Content */}
              {isExpanded && (
                <div className="border-l border-[#2A2A2A] ml-3.5 my-0.5">
                  {renderExplorerNode(nodes, node.id, depth + 1)}
                </div>
              )}
            </div>
          ) : (
            /* File Node */
            <div
              onClick={() => {
                setActiveFileId(node.id);
                if (!openTabs.includes(node.id)) {
                  setOpenTabs([...openTabs, node.id]);
                }
                if (isMobile) {
                  setActiveMobileTab("editor");
                }
              }}
              title={getItemFullPath(node)}
              className={`flex items-center justify-between group py-1.5 px-2 hover:bg-[#2A2A2A] cursor-pointer select-none transition-colors border-l-2 ${
                isActive ? "border-[#4A9eff] bg-[#2D2D2D]" : "border-transparent"
              }`}
            >
              <div className="flex items-center space-x-2 text-[#CCC] min-w-0">
                {node.name.endsWith(".md") ? (
                  <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
                ) : (
                  <span className="text-[#519aba] font-bold text-[11px] font-mono select-none w-4 text-center flex-shrink-0">++</span>
                )}

                {isRenaming ? (
                  <form
                    onSubmit={handleRename}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center"
                  >
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      className="bg-[#121212] border border-[#3A3A3A] rounded text-xs px-1.5 py-0.5 text-zinc-100 outline-none w-28 font-mono"
                      autoFocus
                      onBlur={() => setRenamingId(null)}
                    />
                  </form>
                ) : (
                  <span
                    className={`text-xs font-mono truncate ${
                      isActive ? "text-white font-medium" : "text-[#D1D1D1]"
                    }`}
                  >
                    {node.name}
                  </span>
                )}
              </div>

              {/* File Actions */}
              {!isRenaming && (
                <div className="flex items-center space-x-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0 pl-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenamingId(node.id);
                      setRenameValue(node.name);
                    }}
                    title="Rename"
                    className="p-0.5 text-[#666] hover:text-[#CCC] hover:bg-[#2D2D2D] rounded"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => handleDeleteItem(node.id, e)}
                    title="Delete"
                    className="p-0.5 text-red-400/70 hover:text-red-400 hover:bg-[#2D2D2D] rounded"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      );
    });
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#121212] flex flex-col items-center justify-center font-mono text-[#AAA] space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4A9eff]"></div>
        <div className="text-xs uppercase tracking-widest font-mono">Initializing TU Compiler...</div>
      </div>
    );
  }

  return (
    <div id="ide_container" className="flex flex-col h-screen w-full bg-[#121212] text-[#D1D1D1] overflow-hidden font-sans">
      
      {/* PROFESSIONAL IDE TOP HEADER */}
      <header id="header" className="flex items-center justify-between px-4 h-12 bg-[#181818] border-b border-[#2A2A2A] flex-shrink-0">
        <div className="flex items-center space-x-3 select-none">
          {/* Logo Brand Accent */}
          <div className="px-1.5 h-6 flex items-center justify-center bg-[#2D2D2D] border border-[#3A3A3A] rounded">
            <span className="font-mono text-xs font-bold text-[#4A9eff]">TU</span>
          </div>
          <div>
            <h1 className="text-sm font-mono font-bold tracking-tight text-white">
              TU <span className="text-[#4A9eff]">Compiler</span>
            </h1>
          </div>
        </div>

        {/* Global Compile Action Center */}
        <div className="flex items-center space-x-2">
          {activeFile ? (
            <div className="flex items-center space-x-2">
              <div className="hidden sm:flex items-center gap-2 text-[12px] bg-[#2D2D2D] px-2.5 py-1 rounded border border-[#3A3A3A]">
                <span className="text-[#519aba] font-bold uppercase text-[10px]">
                  {activeFile.name.endsWith(".md") ? "MD" : "C++"}
                </span>
                <span className="text-white font-medium truncate max-w-[150px]">
                  {activeFile.name}
                </span>
              </div>
              <button
                id="run_button"
                onClick={() => triggerRunProgram([])}
                disabled={isRunning || !activeFile.name.match(/\.(cpp|c|cc|h)$/)}
                className={`flex items-center space-x-1.5 px-4 py-1.5 rounded text-xs font-mono font-bold transition-all shadow-sm ${
                  activeFile.name.match(/\.(cpp|c|cc|h)$/)
                    ? "bg-[#107C10] hover:bg-[#0B5A0B] text-white cursor-pointer active:scale-95"
                    : "bg-[#181818] border border-[#333] text-[#666] cursor-not-allowed"
                }`}
                title={activeFile.name.match(/\.(cpp|c|cc|h)$/) ? "Compile & Run Program" : "Only C/C++ files can be compiled"}
              >
                <Play className={`w-3.5 h-3.5 ${isRunning ? "animate-spin text-white" : "text-white"}`} />
                <span>{isRunning ? "RUNNING" : "RUN"}</span>
              </button>
            </div>
          ) : (
            <span className="text-xs font-mono text-[#666]">No active file</span>
          )}
        </div>
      </header>

      {/* MOBILE HEADER TAB TOGGLES */}
      {isMobile && (
        <div id="mobile_toggles" className="flex items-center bg-[#181818] border-b border-[#2A2A2A] flex-shrink-0 p-1 gap-1">
          <button
            onClick={() => setActiveMobileTab("explorer")}
            className={`flex-1 py-1.5 text-center text-xs font-mono font-semibold transition-all rounded border ${
              activeMobileTab === "explorer"
                ? "bg-[#2D2D2D] text-white border-[#3A3A3A]"
                : "text-[#666] border-transparent hover:text-[#CCC]"
            }`}
          >
            Files
          </button>
          <button
            onClick={() => setActiveMobileTab("editor")}
            className={`flex-1 py-1.5 text-center text-xs font-mono font-semibold transition-all rounded border ${
              activeMobileTab === "editor"
                ? "bg-[#2D2D2D] text-white border-[#3A3A3A]"
                : "text-[#666] border-transparent hover:text-[#CCC]"
            }`}
          >
            Editor
          </button>
          <button
            onClick={() => setActiveMobileTab("terminal")}
            className={`flex-1 py-1.5 text-center text-xs font-mono font-semibold transition-all rounded border relative ${
              activeMobileTab === "terminal"
                ? "bg-[#2D2D2D] text-white border-[#3A3A3A]"
                : "text-[#666] border-transparent hover:text-[#CCC]"
            }`}
          >
            Terminal
            {executionState.status === "waiting_for_input" && (
              <span className="ml-1 w-2 h-2 inline-block rounded-full bg-amber-500 animate-ping" />
            )}
          </button>
        </div>
      )}

      {/* CORE WORKSPACE AREA */}
      <div id="workspace" className="flex flex-1 w-full overflow-hidden relative">
        
        {/* DESKTOP SIDEBAR OR MOBILE EXPLORER VIEW */}
        <div
          id="sidebar"
          className={`${
            isMobile
              ? activeMobileTab === "explorer"
                ? "flex w-full"
                : "hidden"
              : sidebarCollapsed
              ? "w-0 overflow-hidden"
              : "w-[240px]"
          } border-r border-[#2A2A2A] bg-[#181818] flex flex-col flex-shrink-0 transition-all duration-200`}
        >
          {/* Explorer Tools Title */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#2A2A2A] flex-shrink-0">
            <span className="text-[10px] font-bold tracking-widest uppercase font-mono text-[#666]">
              Project Explorer
            </span>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setCreatorInput({ visible: true, type: "file", parentId: null, value: "" })}
                title="Create root file"
                className="p-1 text-[#666] hover:text-[#CCC] hover:bg-[#2A2A2A] rounded transition-colors"
              >
                <FilePlus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setCreatorInput({ visible: true, type: "folder", parentId: null, value: "" })}
                title="Create root folder"
                className="p-1 text-[#666] hover:text-[#CCC] hover:bg-[#2A2A2A] rounded transition-colors"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* New Item Form Inlined */}
          <AnimatePresence>
            {creatorInput.visible && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="p-2 border-b border-[#2A2A2A] bg-[#121212] flex-shrink-0"
              >
                <form onSubmit={handleCreateItem} className="flex flex-col space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-[#666] uppercase font-semibold">
                      New {creatorInput.type}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCreatorInput({ visible: false, type: "file", parentId: null, value: "" })}
                      className="text-[#666] hover:text-[#CCC]"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex space-x-1">
                    <input
                      type="text"
                      placeholder={creatorInput.type === "file" ? "main.cpp" : "Lab-Folder"}
                      value={creatorInput.value}
                      onChange={(e) => setCreatorInput((p) => ({ ...p, value: e.target.value }))}
                      className="bg-black border border-[#3A3A3A] rounded px-2 py-1 text-xs text-zinc-200 outline-none flex-1 font-mono focus:border-[#4A9eff]"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="bg-[#2D2D2D] hover:bg-[#3A3A3A] border border-[#3A3A3A] rounded px-2 text-xs text-[#CCC] font-mono flex items-center justify-center cursor-pointer"
                    >
                      OK
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* VFS Tree Explorer */}
          <div className="flex-1 overflow-y-auto py-2">
            {fs.length === 0 ? (
              <div className="text-center py-8 px-4 text-[#666] font-mono text-xs">
                No folders or files. Click icons to add!
              </div>
            ) : (
              renderExplorerNode(fs, null)
            )}
          </div>
        </div>

        {/* EDITOR & TERMINAL CONTAINER */}
        <div
          id="main_content"
          className={`${
            isMobile
              ? activeMobileTab === "explorer"
                ? "hidden"
                : "flex w-full"
              : "flex-1"
          } flex flex-col h-full overflow-hidden`}
        >
          {/* EDITOR AREA (Hidden on mobile if terminal tab selected) */}
          <div
            id="editor_area"
            className={`${
              isMobile && activeMobileTab === "terminal" ? "hidden" : "flex-1"
            } flex flex-col min-h-0 bg-[#1E1E1E] relative`}
          >
            {/* Editor Tabs row */}
            <div className="flex items-center justify-between h-10 bg-[#181818] border-b border-[#2A2A2A] overflow-x-auto flex-shrink-0 px-2">
              <div className="flex items-center min-w-0 h-full">
                {openTabsList.map((tab) => (
                  <div
                    key={tab.id}
                    onClick={() => setActiveFileId(tab.id)}
                    className={`group flex items-center space-x-2 px-3 py-1 rounded border cursor-pointer select-none transition-colors text-[12px] font-mono relative h-7 mr-1.5 ${
                      activeFileId === tab.id
                        ? "bg-[#2D2D2D] text-white border-[#3A3A3A]"
                        : "bg-transparent text-[#666] border-transparent hover:text-[#CCC] hover:bg-[#2A2A2A]"
                    }`}
                  >
                    <span className="text-[#519aba] font-bold text-[10px] uppercase">C++</span>
                    <span className="font-medium">{tab.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const nextTabs = openTabs.filter((tId) => tId !== tab.id);
                        setOpenTabs(nextTabs);
                        if (activeFileId === tab.id) {
                          if (nextTabs.length > 0) {
                            setActiveFileId(nextTabs[nextTabs.length - 1]);
                          } else {
                            setActiveFileId(null);
                          }
                        }
                      }}
                      className="text-[#666] hover:text-[#CCC] rounded p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Sidebar toggle button (Desktop only) */}
              {!isMobile && (
                <button
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="p-1.5 text-[#666] hover:text-[#CCC] hover:bg-[#2A2A2A] rounded mr-2"
                  title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                >
                  {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeftIcon className="w-4 h-4" />}
                </button>
              )}
            </div>

            {/* Monaco Instance */}
            <div className="flex-1 w-full min-h-0">
              {activeFile ? (
                <Editor
                  height="100%"
                  language={
                    activeFile.name.endsWith(".md")
                      ? "markdown"
                      : activeFile.name.endsWith(".c")
                      ? "c"
                      : "cpp"
                  }
                  theme="vs-dark"
                  value={activeFile.content || ""}
                  onChange={handleEditorChange}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineHeight: 22,
                    fontFamily: "JetBrains Mono, Menlo, Courier New, monospace",
                    automaticLayout: true,
                    tabSize: 4,
                    insertSpaces: true,
                    scrollBeyondLastLine: false,
                    wordWrap: "on",
                    padding: { top: 8, bottom: 8 },
                    renderLineHighlight: "all",
                    cursorBlinking: "smooth",
                    cursorStyle: "line",
                  }}
                  loading={
                    <div className="flex h-full items-center justify-center text-xs font-mono text-[#666]">
                      Loading Editor Engine...
                    </div>
                  }
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-[#666] font-mono text-center px-4">
                  <FileCode className="w-12 h-12 text-[#333] mb-2" />
                  <p className="text-xs max-w-sm">
                    No open files. Select a file from the explorer sidebar to begin coding.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* INTEGRATED TERMINAL (Hidden on mobile if editor tab selected) */}
          <div
            id="terminal_panel"
            className={`${
              isMobile
                ? activeMobileTab === "terminal"
                  ? "flex-1"
                  : "hidden"
                : "h-[240px] border-t border-[#333]"
            } bg-black flex flex-col min-h-0 overflow-hidden select-none`}
          >
            {/* Terminal Header Toolbar */}
            <div className="flex items-center justify-between px-4 h-9 bg-[#121212] border-b border-[#2A2A2A] flex-shrink-0 select-none">
              <div className="flex items-center space-x-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#999]">Terminal</span>
                <span className="text-[11px] text-[#666] font-mono">bash (v5.0.17)</span>
              </div>

              {/* Action shortcuts */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowTerminalConfig(!showTerminalConfig)}
                  className={`flex items-center space-x-1 px-2 py-1 rounded border text-[10px] font-mono transition-colors cursor-pointer ${
                    showTerminalConfig
                      ? "bg-[#2D2D2D] text-[#4A9eff] border-[#4A9eff]/50"
                      : "text-[#AAA] border-[#333] hover:bg-[#2A2A2A]"
                  }`}
                  title="Configure Username and Hostname Prompt"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Prompt Settings</span>
                </button>

                {terminalLogs.length > 0 && (
                  <>
                    <button
                      onClick={handleExportTerminalImage}
                      className="flex items-center space-x-1.5 text-[10px] text-[#AAA] border border-[#333] px-2 py-1 rounded hover:bg-[#2A2A2A] font-mono transition-colors cursor-pointer"
                      title="Save terminal as high-fidelity PNG"
                    >
                      <Download className="w-3 h-3 text-[#AAA]" />
                      <span>Save Output (.PNG)</span>
                    </button>
                    <button
                      onClick={handleResetTerminal}
                      className="p-1 text-[#666] hover:text-[#CCC] hover:bg-[#2A2A2A] rounded transition-colors cursor-pointer"
                      title="Clear Terminal history"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Expandable Terminal Prompt Customization Panel */}
            <AnimatePresence>
              {showTerminalConfig && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-[#121212] border-b border-[#2A2A2A] px-4 py-2 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs font-mono flex-shrink-0"
                >
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-[#666] text-[11px]">User:</span>
                      <input
                        type="text"
                        value={terminalUser}
                        onChange={(e) => {
                          const val = e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, "");
                          setTerminalUser(val || "user");
                          localStorage.setItem("cpp_ide_user", val || "user");
                        }}
                        className="bg-black border border-[#333] rounded px-2 py-0.5 text-white outline-none w-28 focus:border-[#4A9eff] text-center"
                        placeholder="username"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[#666] text-[11px]">Host:</span>
                      <input
                        type="text"
                        value={terminalHost}
                        onChange={(e) => {
                          const val = e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, "");
                          setTerminalHost(val || "host");
                          localStorage.setItem("cpp_ide_host", val || "host");
                        }}
                        className="bg-black border border-[#333] rounded px-2 py-0.5 text-white outline-none w-28 focus:border-[#4A9eff] text-center"
                        placeholder="hostname"
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-[#555] text-[10px] uppercase font-semibold">Presets:</span>
                    <button
                      onClick={() => {
                        setTerminalUser("ankit");
                        setTerminalHost("ascol");
                        localStorage.setItem("cpp_ide_user", "ankit");
                        localStorage.setItem("cpp_ide_host", "ascol");
                      }}
                      className="px-2 py-0.5 bg-[#1E1E1E] border border-[#2D2D2D] hover:bg-[#2D2D2D] rounded text-[#CCC] text-[10px] transition-colors cursor-pointer"
                    >
                      ankit@ascol
                    </button>
                    <button
                      onClick={() => {
                        setTerminalUser("root");
                        setTerminalHost("localhost");
                        localStorage.setItem("cpp_ide_user", "root");
                        localStorage.setItem("cpp_ide_host", "localhost");
                      }}
                      className="px-2 py-0.5 bg-[#1E1E1E] border border-[#2D2D2D] hover:bg-[#2D2D2D] rounded text-[#CCC] text-[10px] transition-colors cursor-pointer"
                    >
                      root@localhost
                    </button>
                    <button
                      onClick={() => {
                        setTerminalUser("developer");
                        setTerminalHost("cppide");
                        localStorage.setItem("cpp_ide_user", "developer");
                        localStorage.setItem("cpp_ide_host", "cppide");
                      }}
                      className="px-2 py-0.5 bg-[#1E1E1E] border border-[#2D2D2D] hover:bg-[#2D2D2D] rounded text-[#CCC] text-[10px] transition-colors cursor-pointer"
                    >
                      developer@cppide
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
 
            {/* Terminal Body Screen */}
            <div
              id="terminal_body"
              onClick={handleTerminalClick}
              className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed text-[#D4D4D4] bg-black scrollbar-thin cursor-text"
            >
              {terminalLogs.length === 0 ? (
                <div className="text-[#666] text-[11px]">
                  <span>
                    <span className="text-[#50fa7b]">{terminalUser}@{terminalHost}</span>:<span className="text-[#8be9fd]">~</span>$ 
                  </span>
                  <span className="animate-pulse text-white">_</span>
                  <div className="mt-2 text-[10px] opacity-70">
                    Console ready. Select a file and click &quot;RUN&quot; above to compile and run your code.
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {terminalLogs.map((log, idx) => {
                    if (log.type === "command") {
                      const pathPart = log.path ? `~/${log.path}` : "~";
                      return (
                        <div key={idx} className="text-[#50fa7b]">
                          <span>{terminalUser}@{terminalHost}</span>:<span className="text-[#8be9fd]">{pathPart}</span>$ <span className="text-white">{log.text}</span>
                        </div>
                      );
                    }
                    if (log.type === "compile-success") {
                      return (
                        <div key={idx} className="text-[#999] my-1 font-medium italic">
                          {log.text}
                        </div>
                      );
                    }
                    if (log.type === "compile-error") {
                      return (
                        <div key={idx} className="text-red-400 whitespace-pre-wrap">
                          {log.text}
                        </div>
                      );
                    }
                    if (log.type === "program-output") {
                      return (
                        <div key={idx} className="whitespace-pre-wrap text-white">
                          {log.text}
                        </div>
                      );
                    }
                    if (log.type === "exit-status") {
                      return (
                        <div key={idx} className="text-[#999] my-1 italic">
                          {log.text}
                        </div>
                      );
                    }
                    return null;
                  })}
 
                  {/* ACTIVE USER INPUT PROMPT (INLINE IN TERMINAL) */}
                  {executionState.status === "waiting_for_input" && (
                    <div className="flex items-center space-x-1 py-1 bg-black border border-[#333] px-2 rounded">
                      <span className="text-[#50fa7b] font-semibold flex-shrink-0 animate-pulse">
                        INPUT &gt;
                      </span>
                      <form onSubmit={handleTerminalInputSubmit} className="flex-1">
                        <input
                          ref={terminalInputRef}
                          type="text"
                          value={currentInputVal}
                          onChange={(e) => setCurrentInputVal(e.target.value)}
                          className="w-full bg-transparent text-white font-mono text-xs border-none outline-none focus:ring-0 p-0 m-0"
                          autoFocus
                          disabled={isRunning}
                          placeholder={
                            executionState.promptedInputVar
                              ? `Enter ${executionState.promptedInputVar}...`
                              : "Enter program input..."
                          }
                        />
                      </form>
                    </div>
                  )}
 
                  {/* Program running loading indicator */}
                  {isRunning && (
                    <div className="text-[#666] animate-pulse text-[11px] flex items-center space-x-2 py-1">
                      <div className="w-1.5 h-1.5 bg-[#107C10] rounded-full animate-ping" />
                      <span>Evaluating and step-tracing program execution...</span>
                    </div>
                  )}
 
                  {/* TRAILING ACTIVE PROMPT FOR FRESH ACTIONS */}
                  {executionState.status !== "running" && executionState.status !== "waiting_for_input" && !isRunning && (
                    <div className="text-[#666] pt-1">
                      <span>
                        <span className="text-[#50fa7b]">{terminalUser}@{terminalHost}</span>:
                        <span className="text-[#8be9fd]">
                          {activeFile ? `~/${getParentFolderPath(activeFile)}` : "~"}
                        </span>$${" "}
                      </span>
                      <span className="animate-pulse text-white">_</span>
                    </div>
                  )}

                  <div ref={terminalEndRef} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Custom Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmation.isOpen && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() =>
                setDeleteConfirmation({
                  isOpen: false,
                  itemId: null,
                  itemName: "",
                  itemType: "file",
                })
              }
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />

            {/* Dialog Content */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-md bg-[#181818] border border-red-500/30 rounded-lg shadow-2xl p-6 overflow-hidden z-10"
            >
              {/* Glowing accent border top */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-red-500" />

              <div className="flex items-start space-x-3">
                <div className="p-2 bg-red-500/10 rounded-full text-red-500 flex-shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                    Confirm Deletion
                  </h3>
                  <p className="mt-2 text-xs text-[#AAA] leading-relaxed font-mono">
                    Are you sure you want to permanently delete the {deleteConfirmation.itemType}{" "}
                    <span className="text-white font-mono font-semibold">
                      &ldquo;{deleteConfirmation.itemName}&rdquo;
                    </span>
                    ? All nested contents will also be removed. This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end space-x-2">
                <button
                  onClick={() =>
                    setDeleteConfirmation({
                      isOpen: false,
                      itemId: null,
                      itemName: "",
                      itemType: "file",
                    })
                  }
                  className="px-4 py-2 text-xs font-mono font-medium rounded text-[#AAA] hover:text-white bg-[#2A2A2A] hover:bg-[#333] border border-[#333] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (deleteConfirmation.itemId) {
                      executeDeleteItem(deleteConfirmation.itemId);
                    }
                  }}
                  className="px-4 py-2 text-xs font-mono font-medium rounded text-white bg-red-600 hover:bg-red-500 border border-red-700 transition-colors cursor-pointer flex items-center space-x-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Alert Dialog Modal */}
      <AnimatePresence>
        {customAlert.isOpen && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCustomAlert({ isOpen: false, title: "", message: "" })}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />

            {/* Dialog Content */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-md bg-[#181818] border border-[#333] rounded-lg shadow-2xl p-6 overflow-hidden z-10"
            >
              {/* Glowing accent border top */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-[#4A9eff]" />

              <div className="flex items-start space-x-3">
                <div className="p-2 bg-[#4A9eff]/10 rounded-full text-[#4A9eff] flex-shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                    {customAlert.title}
                  </h3>
                  <p className="mt-2 text-xs text-[#AAA] leading-relaxed font-mono">
                    {customAlert.message}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end">
                <button
                  onClick={() => setCustomAlert({ isOpen: false, title: "", message: "" })}
                  className="px-5 py-2 text-xs font-mono font-medium rounded text-white bg-[#4A9eff] hover:bg-[#3b8ee5] transition-colors cursor-pointer"
                >
                  OK
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ChevronLeft Icon Component replacement
function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}
