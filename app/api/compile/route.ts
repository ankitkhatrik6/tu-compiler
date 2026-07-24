import { GoogleGenAI, Type } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "tucompiler-build",
    },
  },
});

export async function POST(req: NextRequest) {
  try {
    const { filename, code, inputs, files = [] } = await req.json();

    if (!code) {
      return NextResponse.json({ error: "No code provided" }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({
        compiled: false,
        compileErrors: "Gemini API Key is missing. Please configure GEMINI_API_KEY in the environment variables (Settings).",
        status: "runtime_error",
        exitCode: 1,
        runtimeError: "Missing GEMINI_API_KEY environment variable.",
        output: "Error: GEMINI_API_KEY environment variable is not defined.",
        executionTime: 0.0,
      });
    }

    const isCpp = filename?.endsWith(".cpp") || filename?.endsWith(".hpp") || filename?.endsWith(".cc") || filename?.endsWith(".h");
    const compilerName = isCpp ? "g++" : "gcc";

    const systemInstruction = `You are a state-of-the-art sandboxed compiler and runtime execution environment for C and C++ console programs.
Your task is to act exactly as a strict, accurate, and professional C/C++ compiler (${compilerName}) and a real Linux console executor (similar to Dev-C++ execution env or standard bash/cmd terminal).

CRITICAL DIRECTIVES FOR ACCURACY:
1. BE EXTREMELY CHARITABLE AND CONFORMING. Do NOT report compile errors unless the code contains actual, genuine syntax, type, or structural violations that real GCC/G++ (${compilerName}) would absolutely fail to compile. Standard-conformant modern C/C++ (C++11, C++14, C++17, C++20) using namespaces, templates, classes, standard libraries, or dynamic allocations should NEVER fail compilation.
2. LOCAL INCLUDES RESOLUTION: You will be provided with an optional list of "Other Workspace Files". If the main code has an include like '#include "utils.h"', look through the provided workspace files list for a file named "utils.h" or "include/utils.h", and resolve any referenced functions or variables. Do NOT fail compilation due to unresolved local includes if the corresponding header/cpp exists in the workspace.
3. STANDARD HEADERS: Standard C/C++ headers (such as <iostream>, <vector>, <string>, <algorithm>, <cmath>, <map>, <set>, <queue>, <stack>, <iomanip>, <cstdio>, <cstdlib>, <cstring>, <ctime>, <sstream>) are fully supported and standard references should never trigger compilation errors.
4. EXACT EXECUTION STEP-TRACING:
   - Carefully execute the code starting from 'int main(...)'.
   - Keep perfect, precise track of the state of variables, conditions, loops, array values, functions, class fields, recursion, pointers, and memory operations.
   - Accurately compute standard output and standard error.
5. INPUTS AND PROMPTS SYNCHRONIZATION:
   - When the code executes an input stream command (like std::cin >> var, scanf("%d", &var), std::getline(std::cin, var), getchar(), etc.):
     - Look at the provided "inputs" list (an array of strings entered by the user in order).
     - Match the prompt sequence with the items in the "inputs" array.
     - If an input exists for this current input step, consume it: append it directly to the console output string (representing the user typing the input, followed by a newline where applicable in a standard interactive terminal), update the state of the corresponding variable in the simulated code execution, and continue executing.
     - If NO input exists in the array for the current prompt (e.g. the program requires more inputs than what have been entered so far), you MUST immediately halt execution.
       - Set "status" to "waiting_for_input".
       - Set "promptedInputVar" to a very brief description of the input expected (e.g., "employee type", "basic salary", "number of elements", "your name").
       - Set "compiled" to true.
       - Set "output" to the exact accumulated console text *up to this point*, stopping precisely at the prompt cursor, without hallucinating any input value.
6. INFINITE LOOPS & TIMEOUTS: If the program contains a loop that runs indefinitely (e.g., more than 200 iterations with no progress or waiting for inputs), stop simulation, set "status" to "runtime_error", and set "runtimeError" to "Execution timed out (possible infinite loop)".
7. RUNTIME CRASHES: If the program does something invalid (like division by zero, null pointer dereference, out-of-bounds access), set "status" to "runtime_error" and specify the type of crash in "runtimeError".
8. OUTPUT FORMATTING: The output property must contain the exact, character-for-character console text. Do not add any compiler banners, helper instructions, JSON formatting, or unsolicited diagnostic logs in the "output" string. Make it look perfectly like a clean command prompt execution.`;

    let otherFilesContext = "";
    if (Array.isArray(files) && files.length > 0) {
      otherFilesContext = "OTHER FILES IN PROJECT WORKSPACE (use these to resolve headers and local #includes):\n";
      files.forEach((f: any) => {
        if (f && f.name && f.name !== filename && typeof f.content === "string") {
          otherFilesContext += `\n--- File: ${f.name} ---\n${f.content}\n--- End File: ${f.name} ---\n`;
        }
      });
    }

    const userPrompt = `Simulate compiling and running this C/C++ program.

ACTIVE FILE TO RUN:
File Name: ${filename || "main.cpp"}
--- CODE ---
${code}
--- END CODE ---

${otherFilesContext}

SEQUENTIAL INPUTS RECEIVED SO FAR (in exact sequence of prompts):
${JSON.stringify(inputs || [])}

Return the structured JSON result representing the compilation status, output, and execution state according to the schema.`;

    const reqConfig = {
      systemInstruction,
      temperature: 0.1,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          compiled: {
            type: Type.BOOLEAN,
            description: "True if compilation succeeds, false if there are syntax/compiler errors.",
          },
          compileErrors: {
            type: Type.STRING,
            description: "G++ / GCC compiler error message if compilation fails, matching standard terminal GCC output. Empty if compiled is true.",
          },
          status: {
            type: Type.STRING,
            description: "Must be one of: 'exited', 'waiting_for_input', or 'runtime_error'.",
          },
          exitCode: {
            type: Type.INTEGER,
            description: "Process exit code (typically 0 for success). Required.",
          },
          runtimeError: {
            type: Type.STRING,
            description: "Description of the runtime error if status is 'runtime_error'.",
          },
          output: {
            type: Type.STRING,
            description: "The complete accumulated console output up to the current point, including echoed user inputs.",
          },
          executionTime: {
            type: Type.NUMBER,
            description: "A realistic execution time in seconds (e.g. 0.003). Small decimal number.",
          },
          promptedInputVar: {
            type: Type.STRING,
            description: "If status is 'waiting_for_input', a description of the variable requested.",
          },
        },
        required: ["compiled", "compileErrors", "status", "exitCode", "runtimeError", "output", "executionTime"],
      },
    };

    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: userPrompt,
        config: reqConfig,
      });
    } catch (primaryErr) {
      console.warn("Primary model gemini-2.5-flash failed, falling back to gemini-2.0-flash:", primaryErr);
      response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: userPrompt,
        config: reqConfig,
      });
    }

    const rawText = response.text || "";
    if (!rawText.trim()) {
      throw new Error("No response text from Gemini API");
    }

    // Sanitize JSON response if wrapped in markdown fence blocks
    let cleanedText = rawText.trim();
    if (cleanedText.startsWith("```")) {
      cleanedText = cleanedText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    }

    const data = JSON.parse(cleanedText);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Compile API error:", error);
    return NextResponse.json(
      {
        compiled: false,
        compileErrors: "g++: internal compiler error: failed to communicate with execution sandbox. Please try again.",
        status: "runtime_error",
        exitCode: 1,
        runtimeError: error.message || "Internal Server Error",
        output: "Internal Server Error during compilation.",
        executionTime: 0.0,
      },
      { status: 500 }
    );
  }
}
