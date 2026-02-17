// Message — THE universal communication format
// Every agent sends and receives messages. Nothing else.

export interface Message {
  id: string;
  from: string;       // agent name who sent this
  to: string;         // agent name or "*" for broadcast
  type: MessageType;
  payload: any;       // the actual data
  replyTo?: string;   // id of message this replies to
  metadata?: Record<string, any>;
  timestamp: string;
}

export type MessageType =
  | "task"           // "do this work"
  | "result"         // "here's the output"
  | "error"          // "something went wrong"
  | "query"          // "do you know X?"
  | "register"       // "I exist, here's what I can do"
  | "discover"       // "who can do X?"
  | "event";         // "something happened" (broadcast)

export function createMessage(
  from: string,
  to: string,
  type: MessageType,
  payload: any,
  replyTo?: string
): Message {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    from,
    to,
    type,
    payload,
    replyTo,
    timestamp: new Date().toISOString(),
  };
}

// Standard task payload
export interface TaskPayload {
  action: string;          // what to do
  input: Record<string, any>;  // data needed
  context?: Record<string, any>; // extra context
}

// Standard result payload
export interface ResultPayload {
  success: boolean;
  output: any;
  logs?: string[];
}

// Standard error payload
export interface ErrorPayload {
  code: string;
  message: string;
  retryable: boolean;
}
