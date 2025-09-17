## Plugin Structure

Each plugin should be a valid JavaScript module that exports at least one of the following functions:

- onStart: async function (signal) { ... }
  Example:

```js
module.exports = {
  onStart: async function (signal) {
    // Initialization code here
  },
};
```

- onStop: async function (signal) { ... }
  Example:

```js
module.exports = {
  onStop: async function (signal) {
    // Cleanup code here
  },
};
```

- onSchedule: async function (signal) { ... } // optional, for periodic tasks, requires a `cron` field
  Example:

```js
module.exports = {
  cron: "0 * * * *", // Runs every hour
  onSchedule: async function (signal) {
    // Scheduled task code here
  },
};
```
