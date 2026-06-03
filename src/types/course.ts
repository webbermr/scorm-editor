// The SCORM Editor course document — one nested object. All mutations go
// through the history-wrapped commit in the course store.

export type ScormVersion = '1.2' | '2004';

export type SlideType = 'title' | 'content' | 'video' | 'quiz' | 'branching';

export type SlideStatus = 'complete' | 'in-progress' | 'not-started';

export type MasteryRule = 'completed-passed' | 'passed' | 'completed' | 'visited';

export type CalloutTone = 'info' | 'warning';

export type ImageKind = 'shield' | 'lock' | 'video' | 'generic';

// ---- Blocks (content / title / video slides) ----

export interface EyebrowBlock {
  id: string;
  type: 'eyebrow';
  text: string;
}
export interface HeadingBlock {
  id: string;
  type: 'heading';
  text: string;
}
export interface ParagraphBlock {
  id: string;
  type: 'paragraph';
  text: string;
}
export interface ListBlock {
  id: string;
  type: 'list';
  items: string[];
}
export interface ImageBlock {
  id: string;
  type: 'image';
  /** gradient-placeholder kind OR (after import / replace) an object-URL we render directly */
  src: ImageKind | string;
  /** true when src is a real image URL (imported / uploaded) rather than a placeholder kind */
  url?: string;
  /** package-relative path of the source image, so its object-URL can be re-created
   *  after a reload (object URLs don't survive a page refresh) */
  assetPath?: string;
  alt?: string;
  caption?: string;
}
export interface CalloutBlock {
  id: string;
  type: 'callout';
  tone: CalloutTone;
  title: string;
  text: string;
}
export interface VideoBlock {
  id: string;
  type: 'video';
  poster: string;
  length: string;
  title: string;
  required: boolean;
}
/** Imported HTML that could not be decomposed into editable blocks. Read-only, still previewable. */
export interface RawHtmlBlock {
  id: string;
  type: 'rawHtml';
  html: string;
}

export type Block =
  | EyebrowBlock
  | HeadingBlock
  | ParagraphBlock
  | ListBlock
  | ImageBlock
  | CalloutBlock
  | VideoBlock
  | RawHtmlBlock;

export type BlockType = Block['type'];

// ---- Quiz ----

export interface QuizOption {
  id: string;
  text: string;
  correct: boolean;
}
export interface QuizQuestion {
  id: string;
  text: string;
  options: QuizOption[];
  feedbackCorrect?: string;
  feedbackIncorrect?: string;
}
export interface Quiz {
  prompt: string;
  instruction: string;
  kind: 'single' | 'multiple';
  shuffle: boolean;
  feedback: boolean;
  questions: QuizQuestion[];
}

// ---- Branching scenario ----

export type ScenarioOutcome = 'correct' | 'partial' | 'incorrect';

export interface ScenarioChoice {
  id: string;
  text: string;
  outcome: ScenarioOutcome;
  result: string;
}
export interface Scenario {
  setup: string;
  choices: ScenarioChoice[];
}

// ---- Slide ----

export interface Slide {
  id: string;
  type: SlideType;
  name: string;
  status: SlideStatus;
  duration: string;
  blocks?: Block[];
  quiz?: Quiz;
  scenario?: Scenario;
  /** set true when import produced a non-decomposed raw-HTML block — flagged in the UI */
  rawImported?: boolean;
  /** package-relative path of the original imported page (for the "View Original" iframe) */
  sourceHref?: string;
}

// ---- Course meta + root ----

export interface CourseMeta {
  title: string;
  package: string;
  identifier: string;
  scormVersion: ScormVersion;
  edition: string;
  language: string;
  author: string;
  duration: string;
  passingScore: number;
  masteryRule: MasteryRule;
  trackTime: boolean;
  allowReview: boolean;
  description: string;
  /** authoring tool detected on import (e.g. "Lectora"), if recognized */
  authoringTool?: string;
}

export interface Course {
  meta: CourseMeta;
  slides: Slide[];
}

// ---- Supporting reference data ----

export interface CompletionRule {
  id: MasteryRule;
  label: string;
  desc: string;
}

export interface SlideTypeDef {
  id: SlideType;
  label: string;
  desc: string;
}
