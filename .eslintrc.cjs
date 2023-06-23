/** @type {import('eslint').Linter.Config} */
const config = {
  extends: ["@aejay/eslint-config/ts-prettier"],
  env: {
    node: true,
  },
};

module.exports = config;
