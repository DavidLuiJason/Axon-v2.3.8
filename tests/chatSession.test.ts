/**
 * Chat session tests: a chat keeps every message when the user leaves it and returns.
 * Pure reducer tests; no screen is needed.
 */
import { axonReducer, initialAxonState } from '../src/state/axonState';
import type { AxonAction, AxonState } from '../src/state/axonState';
import type { ChatMessage, RecentChat } from '../src/types';

let checks = 0;
function assert(cond: boolean, msg: string) {
  checks += 1;
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  OK: ${msg}`);
}

function msg(id: string, role: 'user' | 'assistant', content: string): ChatMessage {
  return { id, role, content, timestamp: 1 };
}

function freeze<T>(value: T): T {
  return Object.freeze(value);
}

function apply(state: AxonState, ...actions: AxonAction[]): AxonState {
  return actions.reduce((s, a) => axonReducer(freeze(s), a), state);
}

function recent(id: string, messages: ChatMessage[]): RecentChat {
  return { id, title: id, timestamp: 'Just now', messages };
}

function messagesOf(state: AxonState, chatId: string): ChatMessage[] {
  return state.recents.find((r) => r.id === chatId)?.messages ?? [];
}

const empty: AxonState = { ...initialAxonState, recents: [], messages: [], activeChatId: null };

console.log('=== chat session tests ===');

console.log('-- the reported bug: leave a chat and come back');
{
  const u1 = msg('u1', 'user', 'hello');
  const a1 = msg('a1', 'assistant', 'hi, this is the reply');
  let s = apply(empty, { type: 'START_CHAT', payload: { recent: recent('chat-1', [u1]) } });
  assert(s.activeChatId === 'chat-1' && s.messages.length === 1 && s.recents.length === 1, 'a new chat is created, shown and saved');
  s = apply(s, { type: 'APPEND_TO_CHAT', payload: { chatId: 'chat-1', message: a1 } });
  assert(s.messages.length === 2 && messagesOf(s, 'chat-1').length === 2, 'the reply is in the live view and in the saved chat');
  s = apply(s, { type: 'CLEAR_CHAT' });
  assert(s.activeChatId === null && s.messages.length === 0, 'a new chat starts empty');
  s = apply(s, { type: 'OPEN_CHAT', payload: { chatId: 'chat-1', messages: messagesOf(s, 'chat-1') } });
  assert(s.messages.length === 2 && s.messages[1].id === 'a1', 'going back shows the reply again');
}

console.log('-- later turns are kept too');
{
  let s = apply(empty, { type: 'START_CHAT', payload: { recent: recent('chat-1', [msg('u1', 'user', 'one')]) } });
  s = apply(s,
    { type: 'APPEND_TO_CHAT', payload: { chatId: 'chat-1', message: msg('a1', 'assistant', 'reply one') } },
    { type: 'APPEND_TO_CHAT', payload: { chatId: 'chat-1', message: msg('u2', 'user', 'two') } },
    { type: 'APPEND_TO_CHAT', payload: { chatId: 'chat-1', message: msg('a2', 'assistant', 'reply two') } },
    { type: 'CLEAR_CHAT' }
  );
  s = apply(s, { type: 'OPEN_CHAT', payload: { chatId: 'chat-1', messages: messagesOf(s, 'chat-1') } });
  assert(s.messages.map((m) => m.id).join(',') === 'u1,a1,u2,a2', 'all four messages come back in order');
}

console.log('-- a reply that arrives after switching chats');
{
  let s = apply(empty, { type: 'START_CHAT', payload: { recent: recent('chat-A', [msg('uA', 'user', 'question in A')]) } });
  s = apply(s, { type: 'CLEAR_CHAT' });
  s = apply(s, { type: 'START_CHAT', payload: { recent: recent('chat-B', [msg('uB', 'user', 'question in B')]) } });
  s = apply(s, { type: 'APPEND_TO_CHAT', payload: { chatId: 'chat-A', message: msg('aA', 'assistant', 'late reply for A') } });
  assert(s.activeChatId === 'chat-B' && s.messages.map((m) => m.id).join(',') === 'uB', 'the chat being shown is not polluted by the late reply');
  assert(messagesOf(s, 'chat-A').map((m) => m.id).join(',') === 'uA,aA', 'the late reply is saved in the chat it answers');
  assert(messagesOf(s, 'chat-B').map((m) => m.id).join(',') === 'uB', 'the other chat is untouched');
}

console.log('-- edge cases');
{
  const placeholder = [msg('ref1', 'user', 'reference question'), msg('ref2', 'assistant', 'reference answer')];
  let s = apply(
    { ...empty, recents: [recent('chat-empty', [])] },
    { type: 'OPEN_CHAT', payload: { chatId: 'chat-empty', messages: placeholder } }
  );
  s = apply(s, { type: 'APPEND_TO_CHAT', payload: { chatId: 'chat-empty', message: msg('u9', 'user', 'my words') } });
  assert(s.messages.length === 3 && messagesOf(s, 'chat-empty').length === 3, 'a seeded empty chat keeps what is shown plus the new message');

  const unknownShown = apply(
    { ...empty, activeChatId: 'ghost', messages: [msg('g1', 'user', 'x')] },
    { type: 'APPEND_TO_CHAT', payload: { chatId: 'ghost', message: msg('g2', 'assistant', 'y') } }
  );
  assert(unknownShown.messages.length === 2 && unknownShown.recents.length === 0, 'an unsaved chat that is shown still gets its reply on screen');

  const unknownHidden = apply(empty, { type: 'APPEND_TO_CHAT', payload: { chatId: 'nobody', message: msg('n1', 'assistant', 'z') } });
  assert(unknownHidden === empty, 'a message for a chat that does not exist and is not shown changes nothing');

  const original: AxonState = freeze({ ...empty, recents: freeze([recent('c', freeze([msg('m', 'user', 'q')]))]), activeChatId: 'c', messages: freeze([msg('m', 'user', 'q')]) });
  axonReducer(original, { type: 'APPEND_TO_CHAT', payload: { chatId: 'c', message: msg('r', 'assistant', 'a') } });
  assert(original.messages.length === 1 && original.recents[0].messages.length === 1, 'the reducer never changes the state it was given');

  const two = apply(empty,
    { type: 'START_CHAT', payload: { recent: recent('chat-1', [msg('u1', 'user', 'a')]) } },
    { type: 'CLEAR_CHAT' },
    { type: 'START_CHAT', payload: { recent: recent('chat-2', [msg('u2', 'user', 'b')]) } }
  );
  assert(two.recents.map((r) => r.id).join(',') === 'chat-2,chat-1', 'newest chat is first in the recent list');

  const old = apply(empty, { type: 'SET_ACTIVE_CHAT_ID', payload: 'x' }, { type: 'SET_MESSAGES', payload: [msg('s', 'user', 's')] });
  assert(old.activeChatId === 'x' && old.messages.length === 1 && old.recents.length === 0, 'the older set-messages action still works and does not touch saved chats');
}

console.log(`=== chat session tests passed: ${checks} checks ===`);
