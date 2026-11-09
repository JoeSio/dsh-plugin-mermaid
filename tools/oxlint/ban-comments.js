const ALLOWED_STARTS = [
  "webpackignore",
  "vite-ignore",
  "oxlint-",
  "eslint",
  "prettier-",
  "oxfmt-",
  "@ts-",
  "@license",
  "@preserve",
  "@__pure__",
  "@__no_side_effects__",
  "sourcemappingurl",
  "v8 ignore",
  "c8 ignore",
  "istanbul ignore",
];

function normalizeCommentBody(value) {
  return value.replace(/^[*!\s]+/, "").trimStart().toLowerCase();
}

function isAllowedComment(comment) {
  const body = normalizeCommentBody(comment.value);
  if (body.startsWith("/")) return true;
  return ALLOWED_STARTS.some((prefix) => body.startsWith(prefix));
}

const banCommentsRule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow source comments; prefer clearer names or tests.",
    },
    fixable: "code",
    schema: [],
    messages: {
      banned: "Comments are banned; use a clearer name or a test.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();
    return {
      Program() {
        for (const comment of sourceCode.getAllComments()) {
          if (isAllowedComment(comment)) continue;
          context.report({
            loc: comment.loc,
            messageId: "banned",
            fix(fixer) {
              return fixer.removeRange(comment.range);
            },
          });
        }
      },
    };
  },
};

export default {
  meta: {
    name: "ban-comments",
  },
  rules: {
    "ban-comments": banCommentsRule,
  },
};
