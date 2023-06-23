# @aejay/eslint-config

A set of [eslint](https://eslint.org/) configs with Aejay's current opinions
baked in, with several options based on what kind of project they are used for.

## Using these configs

If you somehow happen to share my exact opinions, you should be able to use the
main config (for typescript projects with prettier) by installing
`@aejay/eslint-config` as a devDependency and specifying this in your
`.eslintrc.js` file:

```js
module.exports = {
  extends: ["@aejay/eslint-config"],
};
```

Or, you can specify the config explicitly (this is identical to the above):

```js
module.exports = {
  extends: ["@aejay/eslint-config/ts-prettier"],
};
```

See the following section for the configs available to be extended this way.

## Available Configs

### `@aejay/eslint-config/ts-prettier` (default export)

Configures eslint with:

- `eslint:recommended`
- `plugin:@typescript-eslint/recommended`
- `prettier`

### `@aejay/eslint-config/ts-prettier-react`

Same as the `ts-prettier` config, but with the `eslint-config-react-app` rules
added.
