// Minimal ambient types for Chrome's built-in Prompt API (global `LanguageModel`).
// Not yet part of TypeScript's shipped lib.dom.d.ts. Covers only what this
// project actually calls, per the current official docs (verified against
// developer.chrome.com/docs/ai/prompt-api and the webmachinelearning/prompt-api
// spec — see src/ai/explainer.ts).
export {};

declare global {
  type LanguageModelAvailability = 'unavailable' | 'downloadable' | 'downloading' | 'available';

  interface LanguageModelExpectedIO {
    type: 'text';
    languages: string[];
  }

  interface LanguageModelOptions {
    expectedInputs?: LanguageModelExpectedIO[];
    expectedOutputs?: LanguageModelExpectedIO[];
  }

  interface LanguageModelInitialPrompt {
    role: 'system' | 'user' | 'assistant';
    content: string;
  }

  interface LanguageModelDownloadProgressEvent {
    loaded: number;
  }

  interface LanguageModelMonitor {
    addEventListener(
      type: 'downloadprogress',
      listener: (event: LanguageModelDownloadProgressEvent) => void,
    ): void;
  }

  interface LanguageModelCreateOptions extends LanguageModelOptions {
    initialPrompts?: LanguageModelInitialPrompt[];
    monitor?: (monitor: LanguageModelMonitor) => void;
    signal?: AbortSignal;
  }

  interface LanguageModelPromptOptions {
    responseConstraint?: object;
    omitResponseConstraintInput?: boolean;
    signal?: AbortSignal;
  }

  interface LanguageModelSession {
    prompt(input: string, options?: LanguageModelPromptOptions): Promise<string>;
    clone(): Promise<LanguageModelSession>;
    destroy(): void;
  }

  interface LanguageModelStatic {
    availability(options?: LanguageModelOptions): Promise<LanguageModelAvailability>;
    create(options?: LanguageModelCreateOptions): Promise<LanguageModelSession>;
  }

  var LanguageModel: LanguageModelStatic | undefined;
}
