// Reads [{tex, display}] on stdin, writes the KaTeX HTML for each on stdout.
// Build-time only: the app ships the HTML and katex.min.css, not KaTeX itself.
import katex from 'katex';

let input = '';
for await (const chunk of process.stdin) input += chunk;
// Google's MathJax leaves a bare % as text; in TeX it starts a comment.
const out = JSON.parse(input).map(({ tex: raw, display }) => {
  const tex = raw.replace(/(?<!\\)%/g, '\\%');
  try {
    return katex.renderToString(tex, { displayMode: display, throwOnError: true, output: 'html', strict: false });
  } catch (e) {
    console.error(`[katex] ${e.message.split('\n')[0]} :: ${tex}`);
    return katex.renderToString(tex, { displayMode: display, throwOnError: false, output: 'html', strict: false });
  }
});
process.stdout.write(JSON.stringify(out));
