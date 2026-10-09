/**
 * Brain tests: Text Counter counting, command matching, local rules (follow-ups, help),
 * the router, the foundation fallback, and the boundary the screens call.
 */
import { countText } from '../src/kernel/textCount';
import { createAxonEngine } from '../src/kernel/axonEngine';
import { TEXT_COUNT_COMMAND, TEXT_QUESTION } from '../src/brain/textCountCommand';
import { createLocalRules, PENDING_TTL_MS } from '../src/brain/localRules';
import { createFoundation } from '../src/brain/foundation';
import { createBrain, PLANNED_SOURCES } from '../src/brain/brain';
import type { BrainProvider, BrainReply, BrainRequest } from '../src/brain/types';
import { sendQueryToAxonBoundary } from '../src/services/axonBrainInterface';

let checks = 0;
function assert(cond: boolean, msg: string) {
  checks += 1;
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  OK: ${msg}`);
}

const ask = (text: string): BrainRequest => ({ text, place: 'chat' });

function matchesRun(message: string, text: string, unit: string): boolean {
  const m = TEXT_COUNT_COMMAND.match(message);
  return !!m && !m.ask && m.input.text === text && m.input.unit === unit;
}

function newRules(clock?: { t: number }) {
  const engine = createAxonEngine();
  const rules = createLocalRules({
    commands: [TEXT_COUNT_COMMAND],
    engine,
    planned: PLANNED_SOURCES,
    now: clock ? () => clock.t : undefined,
  });
  return { engine, rules };
}

function fake(id: string, opts: { hold?: boolean; reply?: string | null; throws?: boolean }): BrainProvider & { calls: string[] } {
  const calls: string[] = [];
  return {
    id,
    label: id,
    calls,
    status: () => ({ id, label: id, ready: true, note: 'fake' }),
    holdsConversation: () => opts.hold === true,
    async handle(request): Promise<BrainReply | null> {
      calls.push(request.text);
      if (opts.throws) throw new Error('source down');
      return opts.reply === null || opts.reply === undefined ? null : { content: opts.reply, source: id };
    },
  };
}

async function main() {
  console.log('=== brain tests ===');

  console.log('-- countText');
  assert(JSON.stringify(countText('')) === JSON.stringify({ characters: 0, charactersNoSpaces: 0, letters: 0, words: 0, lines: 0 }), 'empty text counts as zero everywhere');
  const hello = countText('Hello brave new world');
  assert(hello.words === 4 && hello.characters === 21 && hello.charactersNoSpaces === 18 && hello.letters === 18 && hello.lines === 1, 'plain sentence counted exactly');
  assert(countText('  many   spaces   here  ').words === 3, 'extra spaces do not create words');
  assert(countText('one\ntwo\nthree').lines === 3, 'three lines');
  assert(countText('one\ntwo\n').lines === 2, 'a final line break does not add a line');
  assert(countText('\n').lines === 1, 'a lone line break is one line');
  assert(countText('a\r\nb\rc').lines === 3, 'Windows and old Mac line breaks counted');
  assert(countText('\u{1F600}\u{1F600}').characters === 2, 'an emoji counts as one character');
  assert(countText('caf\u00e9 na\u00efve').letters === 9, 'accented letters count as letters');
  assert(countText('well-known don\'t').words === 2, 'hyphenated and contracted words are single words');
  assert(countText('12 + 34 = 46').letters === 0, 'digits and symbols are not letters');

  console.log('-- command matching: runs');
  assert(matchesRun('count words in hello brave new world', 'hello brave new world', 'words'), 'count words in <text>');
  assert(matchesRun('Count the characters of Good morning', 'Good morning', 'characters'), 'count the characters of <text>, case kept');
  assert(matchesRun('how many words are in the quick brown fox', 'the quick brown fox', 'words'), 'how many words are in <text>');
  assert(matchesRun('how many lines in a b', 'a b', 'lines'), 'how many lines in <text>');
  assert(matchesRun('please count letters in abc def', 'abc def', 'letters'), 'polite lead-in');
  assert(matchesRun('can you count words in: one two', 'one two', 'words'), 'colon after in');
  assert(matchesRun('count words: red green blue', 'red green blue', 'words'), 'count words: <text>');
  assert(matchesRun('word count: red green', 'red green', 'words'), 'word count: <text>');
  assert(matchesRun('character count of hi there', 'hi there', 'characters'), 'character count of <text>');
  assert(matchesRun('count words in "quoted text here"', 'quoted text here', 'words'), 'surrounding quotes removed');
  assert(matchesRun('count words in this text: alpha beta', 'alpha beta', 'words'), '"this text:" label removed');
  assert(matchesRun('count words in line one\nline two', 'line one\nline two', 'words'), 'line breaks in the text are kept');
  assert(matchesRun('count chars in abc', 'abc', 'characters'), 'chars shorthand');

  console.log('-- command matching: asks, and non-commands');
  const a1 = TEXT_COUNT_COMMAND.match('count words');
  assert(!!a1 && a1.ask?.question === TEXT_QUESTION && a1.input.unit === 'words', 'count words with no text asks a question');
  const a2 = TEXT_COUNT_COMMAND.match('how many characters are in this sentence?');
  assert(!!a2 && !!a2.ask && a2.input.unit === 'characters', '"this sentence" is not text, so AXON asks for the text');
  assert(!!TEXT_COUNT_COMMAND.match('word count')?.ask, 'word count with nothing after it asks');
  for (const msg of ['hello', 'count me in', 'can you count in French?', 'how many words can you write', 'what is a word', 'count on me', 'describe axon ui', 'count']) {
    assert(TEXT_COUNT_COMMAND.match(msg) === null, `not a command: "${msg}"`);
  }

  console.log('-- local rules: running a command on the kernel');
  {
    const { engine, rules } = newRules();
    const r = await rules.handle(ask('count words in hello brave new world'));
    assert(r !== null && r.source === 'local-rules', 'a command is answered by local rules');
    assert(r!.content.startsWith('That text has 4 words.'), 'headline gives the answer');
    assert(r!.content.includes('Characters: 21 (18 without spaces)'), 'detail lines included');
    assert(/Ran as task task-1: COMPLETED in \d+ ms/.test(r!.content), 'reply names the real task and how it ended');
    assert(r!.taskId === 'task-1', 'the reply carries its task id');
    assert(engine.getTask('task-1')?.state === 'COMPLETED', 'the task really exists and completed');
    assert(!r!.content.includes('hello brave new world'), 'the reply does not echo the text back');
  }

  console.log('-- local rules: follow-up questions');
  {
    const { engine, rules } = newRules();
    const q = await rules.handle(ask('how many characters are in this sentence?'));
    assert(q !== null && q.content === TEXT_QUESTION && rules.holdsConversation(), 'follow-up asked and the provider holds the conversation');
    assert(engine.listTasks().length === 0, 'asking a question creates no task');
    const answer = await rules.handle(ask('Good morning'));
    assert(answer !== null && answer.content.startsWith('That text has 12 characters (11 without spaces).'), 'the next message is counted with the remembered unit');
    assert(!rules.holdsConversation() && (await rules.handle(ask('Good morning'))) === null, 'after the answer the question is closed');
  }
  {
    const { rules } = newRules();
    await rules.handle(ask('count words'));
    const c = await rules.handle(ask('cancel'));
    assert(c !== null && c.content.startsWith('Okay, cancelled.') && !rules.holdsConversation(), 'cancel is acknowledged and closes the question');
    assert((await rules.handle(ask('some words here'))) === null, 'after cancel the next message is ordinary');
    assert((await rules.handle(ask('cancel'))) === null, 'cancel with no open question is just a message');
  }
  {
    const clock = { t: 5000 };
    const { rules } = newRules(clock);
    await rules.handle(ask('count words'));
    clock.t += PENDING_TTL_MS + 10;
    assert(!rules.holdsConversation(), 'an old question is no longer held');
    assert((await rules.handle(ask('late answer'))) === null, 'an expired follow-up is not used');
  }
  {
    const { rules } = newRules();
    await rules.handle(ask('count words'));
    const r = await rules.handle(ask('count lines in x\ny'));
    assert(r !== null && r.content.startsWith('That text has 2 lines.'), 'a new full command beats an open question');
  }
  {
    const { rules } = newRules();
    const r1 = await rules.handle(ask('word count: a b'));
    assert(r1 !== null && r1.content.startsWith('That text has 2 words.'), 'plural wording');
    const r2 = await rules.handle(ask('count lines in single'));
    assert(r2 !== null && r2.content.startsWith('That text has 1 line.'), 'singular wording');
  }

  console.log('-- local rules: help comes from what is registered');
  {
    const { rules } = newRules();
    for (const phrase of ['what can you do', 'What can you do?', 'help', 'what tools do you have?']) {
      const h = await rules.handle(ask(phrase));
      assert(h !== null && h.content.includes('1. Count text.') && h.content.includes('Not connected yet:'), `"${phrase}" lists the real commands and the unconnected sources`);
    }
    const h = await rules.handle(ask('help'));
    assert(h!.content.includes('your API keys') && h!.content.includes('web search') && h!.content.includes('a local model'), 'every planned source is named as not connected');
    assert(rules.abilities().join(',') === 'Count text', 'abilities come from the registered commands');
    assert(rules.status().ready && rules.status().note === '1 command registered', 'status reports the registered commands');
    assert((await rules.handle(ask('   '))) === null, 'a blank message is not handled');
  }

  console.log('-- router');
  {
    const first = fake('first', { reply: null });
    const second = fake('second', { reply: 'from second' });
    const third = fake('third', { reply: 'from third' });
    const fallback = fake('fallback', { reply: 'from fallback' });
    const brain = createBrain([first, second, third], fallback);
    const r = await brain.ask(ask('anything'));
    assert(r.content === 'from second' && r.source === 'second', 'the first provider that replies wins');
    assert(first.calls.length === 1 && third.calls.length === 0 && fallback.calls.length === 0, 'later providers and the fallback are not asked');
  }
  {
    const none = fake('none', { reply: null });
    const fallback = fake('fallback', { reply: 'from fallback' });
    const r = await createBrain([none], fallback).ask(ask('anything'));
    assert(r.source === 'fallback', 'the fallback answers when no provider does');
  }
  {
    const normal = fake('normal', { reply: 'normal reply' });
    const holder = fake('holder', { hold: true, reply: 'holder reply' });
    const r = await createBrain([normal, holder], fake('fb', { reply: 'x' })).ask(ask('my answer'));
    assert(r.source === 'holder' && normal.calls.length === 0, 'a provider holding a question is asked first');
  }
  {
    const normal = fake('normal', { reply: 'normal reply' });
    const holder = fake('holder', { hold: true, reply: null });
    const r = await createBrain([normal, holder], fake('fb', { reply: 'x' })).ask(ask('not an answer'));
    assert(r.source === 'normal', 'if the holder declines, the others are asked');
  }
  {
    const broken = fake('broken', { throws: true });
    const good = fake('good', { reply: 'ok' });
    const r = await createBrain([broken, good], fake('fb', { reply: 'x' })).ask(ask('anything'));
    assert(r.source === 'good', 'a source that throws is skipped, not fatal');
  }
  {
    const p = fake('p', { reply: 'p reply' });
    const r = await createBrain([p], fake('fb', { reply: 'blank handled' })).ask(ask('   '));
    assert(r.source === 'fb' && p.calls.length === 0, 'a blank request goes straight to the fallback');
  }
  {
    const brain = createBrain([fake('a', { reply: null })], fake('fb', { reply: null }));
    const r = await brain.ask(ask('anything'));
    assert(r.content === 'I could not produce an answer to that.' && r.source === 'fb', 'even a silent fallback gets an honest last answer');
    const s = brain.sources();
    assert(s.connected.map((c) => c.id).join(',') === 'a,fb' && s.planned.length === 5, 'sources lists connected providers and planned ones');
  }

  console.log('-- foundation fallback');
  {
    const f = createFoundation();
    const generic = await f.handle(ask('tell me a story'));
    assert(generic !== null && generic.source === 'foundation' && generic.content.includes("AXON's intelligence layer isn't online yet"), 'the generic reply is honest');
    assert(generic!.suggestionPrompt === 'Say "what can you do" to see what I can run right now.', 'the generic reply points to what AXON can do');
    assert((generic!.planItems ?? []).length === 4, 'the generic reply keeps its four foundation notes');
    const layout = await f.handle(ask('describe axon ui'));
    assert(layout !== null && layout.content.includes('Chat / Web / Apps switch') && (layout.planItems ?? []).length === 3 && layout.hasSources === true, 'the layout reply is unchanged');
  }

  console.log('-- the boundary the screens call');
  {
    const cmd = await sendQueryToAxonBoundary('count words in one two three');
    assert(cmd.role === 'assistant' && cmd.content.startsWith('That text has 3 words.'), 'a command is answered through the boundary');
    assert(cmd.source === 'local-rules' && typeof cmd.taskId === 'string', 'the message records its source and task');
    const help = await sendQueryToAxonBoundary('what can you do');
    assert(help.source === 'local-rules' && help.content.includes('Count text'), 'help works through the boundary');
    const normal = await sendQueryToAxonBoundary('hello there');
    assert(normal.source === 'foundation' && normal.content.includes("AXON's intelligence layer isn't online yet"), 'any other message gets the honest foundation reply');
    assert(normal.hasSources === false && typeof normal.id === 'string' && normal.timestamp > 0, 'the message is well formed');
  }

  console.log(`=== brain tests passed: ${checks} checks ===`);
}

let timer: ReturnType<typeof setTimeout> | undefined;
const watchdog = new Promise<never>((_, reject) => {
  timer = setTimeout(() => reject(new Error('FAIL: brain tests hung (a promise never settled)')), 10000);
});

Promise.race([main(), watchdog]).then(
  () => {
    clearTimeout(timer);
  },
  (err) => {
    clearTimeout(timer);
    console.error(err);
    throw err;
  }
);
