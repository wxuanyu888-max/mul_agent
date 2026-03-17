// Command 类型定义
export type CommandScope = "text" | "native" | "both";

export type CommandCategory =
  | "session"
  | "options"
  | "status"
  | "management"
  | "media"
  | "tools"
  | "info";

export type CommandArgType = "string" | "number" | "boolean";

export type CommandArgChoice = string | { value: string; label: string };

export type CommandArgChoicesProvider = (context: CommandArgChoiceContext) => CommandArgChoice[];

export interface CommandArgChoiceContext {
  command: ChatCommandDefinition;
  arg: CommandArgDefinition;
}

export interface CommandArgDefinition {
  name: string;
  description: string;
  type: CommandArgType;
  required?: boolean;
  choices?: CommandArgChoice[] | CommandArgChoicesProvider;
  preferAutocomplete?: boolean;
  captureRemaining?: boolean;
}

export type CommandArgValue = string | number | boolean;
export type CommandArgValues = Record<string, CommandArgValue>;

export interface CommandArgs {
  raw?: string;
  values?: CommandArgValues;
}

export type CommandArgsParsing = "none" | "positional";

export interface ChatCommandDefinition {
  key: string;
  nativeName?: string;
  description: string;
  textAliases: string[];
  acceptsArgs?: boolean;
  args?: CommandArgDefinition[];
  argsParsing?: CommandArgsParsing;
  formatArgs?: (values: CommandArgValues) => string | undefined;
  scope: CommandScope;
  category?: CommandCategory;
}

export interface NativeCommandSpec {
  name: string;
  description: string;
  acceptsArgs: boolean;
  args?: CommandArgDefinition[];
}

export interface CommandContext {
  surface?: string;
  channel?: string;
  senderId?: string;
  sessionId?: string;
  sessionKey?: string;
  isAuthorized?: boolean;
  rawBodyNormalized?: string;
  commandBodyNormalized?: string;
}

export interface CommandHandlerResult {
  reply?: ReplyPayload;
  shouldContinue: boolean;
}

export interface ReplyPayload {
  text?: string;
  markdown?: string;
  image?: string;
  audio?: string;
  file?: string;
}

export type CommandHandler = (
  context: CommandContext,
  args?: CommandArgs
) => Promise<CommandHandlerResult | null>;

export interface CommandDetection {
  exact: Set<string>;
  regex: RegExp;
}
