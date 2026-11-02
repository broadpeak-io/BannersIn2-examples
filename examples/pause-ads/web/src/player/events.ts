export type PlayerState = 'idle' | 'loading' | 'playing' | 'paused' | 'pause-ad' | 'error'

export type PlayerEvent =
  | { type: 'state'; state: PlayerState; detail?: string }
  | { type: 'log'; source: 'player' | 'smartlib' | 'simid'; message: string; data?: unknown }

export type PlayerListener = (event: PlayerEvent) => void
