# SEARCH-002: Script Metadata Extraction

**Priority**: P0 (Critical)
**Estimate**: 3 hours
**Status**: In Progress - RED Phase

## Objective
Extract metadata from all TypeScript scripts including description, usage, dependencies, and tags.

## Technical Requirements
1. ⏳ TypeScript file content parsing
2. ⏳ JSDoc comment extraction
3. ⏳ Import statement analysis
4. ⏳ Category inference from file path
5. ⏳ Tag generation from content

## API Design
```typescript
export interface ScriptMetadata {
  name: string;
  path: string;
  category: string; // 'audio', 'system', 'dev'
  description: string;
  usage: string;
  tags: string[];
  dependencies: string[];
}

export class ScriptAnalyzer {
  async analyzeScript(filePath: string): Promise<ScriptMetadata>;
  async analyzeAllScripts(rootDir: string): Promise<ScriptMetadata[]>;

  private extractDescription(content: string): string;
  private extractUsage(content: string): string;
  private extractDependencies(content: string): string[];
  private generateTags(content: string): string[];
  private inferCategory(filePath: string): string;
}
```

## Progress
- [ ] Ticket document created
- [ ] RED: Failing tests written
- [ ] GREEN: Minimal implementation
- [ ] REFACTOR: Optimization
- [ ] QUALITY GATE: Tests pass

## Notes
- No AST parsing needed - use regex for JSDoc and imports
- Focus on simple, testable extraction logic
- Following EXTREME TDD workflow
