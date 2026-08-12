module.exports = {
  rules: {
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "refactor", "docs", "test", "chore", "infra"],
    ],
    "subject-empty": [2, "never"],
    "header-max-length": [2, "always", 100],
  },
};
