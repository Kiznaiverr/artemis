export interface RawComment {
  text: string;
  timestampMs: number;
}

export interface WeightedEvent {
  timestampMs: number;
  score: number;
}

export interface LiveChatData {
  events: WeightedEvent[];
  comments: RawComment[];
  subtitleSegments?: import("../ai/types").SubtitleSegment[];
}

/**
 * Raw shape of a single action from a yt-dlp .live_chat.json file.
 * The file is newline-delimited JSON — one object per line.
 */
export interface LiveChatRawEntry {
  replayChatItemAction?: {
    actions?: Array<{
      addChatItemAction?: {
        item?: {
          liveChatTextMessageRenderer?: {
            timestampUsec: string;
            videoOffsetTimeMsec: string;
            message?: {
              runs: Array<{ text?: string; emoji?: unknown }>;
            };
          };
        };
      };
    }>;
    videoOffsetTimeMsec?: string;
  };
}
