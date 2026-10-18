/* Quiz and flashcard logic. Pure; the screens live in tools.js and app.js. */

// How many of a module's questions were answered, and how many right.
export function scoreAnswers(questions, answers) {
  let done = 0, right = 0;
  for (const q of questions) {
    const a = answers[q.key];
    if (a == null || a >= q.block.options.length) continue;
    done++;
    if (q.block.options[a].correct) right++;
  }
  return { done, right, total: questions.length };
}

// A module's key terms, in the order its lessons introduce them, once each.
export function cardsFor(chapter) {
  const seen = new Set();
  for (const sec of chapter.sections) for (const id of sec.terms ?? []) seen.add(id);
  return [...seen];
}
