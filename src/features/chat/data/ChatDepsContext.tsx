import { createContext, useContext } from 'react'
import { defaultChatDeps, type ChatDeps } from './deps'

const ChatDepsContext = createContext<ChatDeps>(defaultChatDeps)

export const ChatDepsProvider = ChatDepsContext.Provider

export function useChatDeps(): ChatDeps {
  return useContext(ChatDepsContext)
}
