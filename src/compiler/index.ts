import type { MediaGraph } from "../ast/types.js";
import { requiresComplexFilter } from "../ast/graph.js";
import { compileSimple, type CompilationResult } from "./simple-compiler.js";
import { compileComplex } from "./complex-compiler.js";

export type { CompilationResult };

/**
 * Compile a media graph to FFmpeg arguments
 */
export function compile(graph: MediaGraph): CompilationResult {
  if (requiresComplexFilter(graph)) {
    return compileComplex(graph);
  }
  return compileSimple(graph);
}
