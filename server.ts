/**
 * ============================================================================
 * FILE: server.ts
 * DESCRIPTION:
 * Express backend server and Vite development middleware host for SpanCraft 3D.
 * Provides the server-side Gemini multimodal vision endpoint
 * (`POST /api/worksheet/analyze`) that inspects uploaded photos of 2D mechanical
 * or civil engineering worksheets (bridges, trusses, frames with pin/roller
 * supports and external load arrows) and extracts a normalized 2D structural
 * graph plus 3D bridge extrapolation presumptions.
 * ============================================================================
 */

import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

// Load environment variables from .env if present
dotenv.config();

// Resolve current file and directory paths for ES Module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express application and configure port 3000
const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Enable JSON body parsing with a generous 25MB limit for base64 worksheet photos
app.use(express.json({ limit: '25mb' }));

/**
 * Instantiates and returns a server-side GoogleGenAI client configured with
 * the runtime GEMINI_API_KEY and required 'aistudio-build' telemetry header.
 */
function getGenAIClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

/**
 * POST /api/worksheet/analyze
 * Accepts a base64-encoded image of an engineering statics/mechanics worksheet.
 * Uses `gemini-3.8-flash` with a strict JSON `responseSchema` to extract:
 * 1. All structural joints (nodes) with meter coordinates (x, y) and support types (pin, roller_y, roller_x, fixed, none)
 * 2. All straight structural beams connecting pairs of joints and their structural role
 * 3. All external force vectors (magnitude in kN and direction angle in degrees)
 * 4. A 3D structural presumption profile describing how the 2D schematic translates into a 3D bridge simulation
 */
app.post('/api/worksheet/analyze', async (req, res) => {
  try {
    const { imageBase64, mimeType, userHint } = req.body as {
      imageBase64?: string;
      mimeType?: string;
      userHint?: string;
    };

    // Validate that an image payload was provided by the client
    if (!imageBase64) {
      res.status(400).json({ error: 'Missing worksheet image payload (imageBase64).' });
      return;
    }

    // Strip any leading Data URL prefix (e.g., "data:image/png;base64,")
    const cleanBase64 = imageBase64.includes(',')
      ? imageBase64.split(',')[1]
      : imageBase64;

    const ai = getGenAIClient();

    // Detailed engineering system prompt instructing Gemini how to read 2D statics diagrams
    const promptText = `You are a senior structural and mechanical engineering professor analyzing a 2D statics / mechanics of materials worksheet photo or diagram of a bridge, truss, or frame.
Carefully extract the complete 2D structural topology from this image into a clean, normalized coordinate system so it can be edited in a 2D Worksheet Editor and extruded into a 3D bridge simulation:
1. Coordinate System:
   - Place the leftmost lowest support joint at (x = 0, y = 0).
   - X increases to the right in meters (typical bridge spans are 8m to 20m; if dimensions are labeled on the worksheet in m or ft, preserve or convert to clean meter values; if unlabeled, use a realistic 12m to 16m span with 3m to 4m bay spacing and 3m to 4.5m height).
   - Y increases upwards in meters.
2. Nodes (Joints & Supports):
   - Give each joint a clean uppercase letter ID ("A", "B", "C", "D", ...).
   - Identify boundary supports accurately from standard engineering symbols:
     - Triangle / knife-edge / hinge pin support -> "pin" (constrains X and Y)
     - Circle / roller / triangle-on-wheels on horizontal ground -> "roller_y" (constrains Y, free in X)
     - Roller on vertical wall -> "roller_x" (constrains X, free in Y)
     - Built-in / cantilevered wall support -> "fixed"
     - All other internal truss joints -> "none"
   - Ensure the structure has at least one "pin" (or "fixed") support and at least one "roller_y" (or second pin) support so it is statically determinate/stable.
3. Beams (Structural Members):
   - Extract every straight structural member connecting two joints.
   - Ensure startNodeId and endNodeId match exact node IDs in the nodes array.
   - Classify each beam's role as "top_chord", "bottom_chord", "web_diagonal", or "web_vertical".
4. External Loads (Forces):
   - Identify all external force arrows acting on joints.
   - Convert forces to kN (if labeled in N, lbf, or kips, convert or normalize to realistic kN between 20 kN and 200 kN; if unlabeled arrows exist, assign realistic values like 60 kN or 100 kN).
   - Specify angleDeg where 0 deg points right (+X), 90 deg points straight up (+Y), -90 deg points straight down (-Y, standard downward gravity load), and 180 deg points left (-X).
5. 3D Bridge Presumption:
   - Infer the 3D bridge archetype ("Through-Truss Bridge", "Deck-Truss Bridge", "Arch Span Bridge", or "Cantilever Structure"), a realistic transverse width between the twin 3D trusses (e.g. 3.2m to 4.5m), whether the road deck sits on the "bottom_chord" or "top_chord", and a 1-2 sentence summary explaining how the 2D worksheet is presumed in 3D.
${userHint ? `Additional user context: ${userHint}` : ''}`;

    // Execute multimodal content generation with structured JSON schema output
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'image/png',
              data: cleanBase64,
            },
          },
          {
            text: promptText,
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: 'Concise engineering title of the extracted bridge or truss worksheet problem.',
            },
            description: {
              type: Type.STRING,
              description: '1-2 sentence summary of the structural configuration, span, and loading conditions.',
            },
            nodes: {
              type: Type.ARRAY,
              description: 'List of structural joints (nodes) with 2D coordinates in meters and support condition.',
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: 'Joint letter ID, e.g., A, B, C' },
                  x: { type: Type.NUMBER, description: 'Horizontal coordinate in meters (m)' },
                  y: { type: Type.NUMBER, description: 'Vertical coordinate in meters (m)' },
                  support: {
                    type: Type.STRING,
                    description: 'Support condition: "none", "pin", "roller_y", "roller_x", or "fixed"',
                  },
                },
                required: ['id', 'x', 'y', 'support'],
              },
            },
            beams: {
              type: Type.ARRAY,
              description: 'List of structural beams/members connecting pairs of nodes.',
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: 'Beam identifier, e.g., AB, BC' },
                  startNodeId: { type: Type.STRING, description: 'Start joint ID' },
                  endNodeId: { type: Type.STRING, description: 'End joint ID' },
                  role: {
                    type: Type.STRING,
                    description: 'Structural role: "top_chord", "bottom_chord", "web_diagonal", or "web_vertical"',
                  },
                },
                required: ['id', 'startNodeId', 'endNodeId', 'role'],
              },
            },
            loads: {
              type: Type.ARRAY,
              description: 'External point loads applied at specific joints.',
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: 'Load identifier, e.g., L1, L2' },
                  nodeId: { type: Type.STRING, description: 'Target joint ID where force is applied' },
                  magnitudeKN: { type: Type.NUMBER, description: 'Force magnitude in kilonewtons (kN), positive value' },
                  angleDeg: {
                    type: Type.NUMBER,
                    description: 'Direction angle in degrees: -90 for downward gravity load, 0 for +X, 180 for -X, 90 for +Y',
                  },
                  label: { type: Type.STRING, description: 'Short label for the load, e.g., P1 = 50 kN' },
                },
                required: ['id', 'nodeId', 'magnitudeKN', 'angleDeg'],
              },
            },
            presumption3D: {
              type: Type.OBJECT,
              description: 'Presumption of how this 2D worksheet structure translates into a 3D bridge.',
              properties: {
                archetype: {
                  type: Type.STRING,
                  description: 'One of: "Through-Truss Bridge", "Deck-Truss Bridge", "Arch Span Bridge", or "Cantilever Structure"',
                },
                transverseWidthM: {
                  type: Type.NUMBER,
                  description: 'Presumed 3D width in meters between front and rear parallel truss planes (e.g. 3.6)',
                },
                deckPlacement: {
                  type: Type.STRING,
                  description: '"bottom_chord" or "top_chord"',
                },
                summary: {
                  type: Type.STRING,
                  description: 'Explanation of how the 2D diagram was extruded into a 3D twin-truss structure with lateral bracing and piers.',
                },
              },
              required: ['archetype', 'transverseWidthM', 'deckPlacement', 'summary'],
            },
            extractionNotes: {
              type: Type.ARRAY,
              description: 'List of 2-4 engineering notes about detected pin/roller joints, dimensions, and load assumptions.',
              items: { type: Type.STRING },
            },
          },
          required: ['title', 'description', 'nodes', 'beams', 'loads', 'presumption3D', 'extractionNotes'],
        },
      },
    });

    const rawText = (response.text ?? '{}').trim();
    const parsed = JSON.parse(rawText);
    res.json(parsed);
  } catch (error: unknown) {
    console.error('Worksheet analysis error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to analyze engineering worksheet image.';
    res.status(500).json({ error: message });
  }
});

/**
 * Starts the Express HTTP server on port 3000.
 * In development, mounts Vite's SSR/SPA middleware for seamless frontend serving.
 * In production, serves compiled static assets from `/dist`.
 */
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SpanCraft 3D server listening on http://localhost:${PORT}`);
  });
}

startServer();
