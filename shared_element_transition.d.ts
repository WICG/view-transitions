interface DocumentTransition {
  start(callback: () => Promise<void> | void): Promise<void>;
  abandon(): void;
}

interface Document {
  createDocumentTransition(): DocumentTransition;
}

interface CSSStyleDeclaration {
  pageTransitionTag: string;
}