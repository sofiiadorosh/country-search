# Country Search — Design

## Architecture overview

The project follows a "functional core, imperative shell" split. Request logic, cancellation, mapping and debouncing are plain TypeScript with no DOM access, so they run and are tested in Node. Side effects live in a few small, clearly named places.

```
src/
  api/       HTTP layer: searchCountries, HttpError, classifyError
  core/      DOM-free logic: debounce, mapCountryResponse, search controller,
             cache with deduplication, search history, formatting, types
  storage/   localStorage access — the only module that touches persistence
  ui/        DOM rendering and event handlers — the only code that touches the DOM
  styles/    SCSS (abstracts, core, layout, components)
tests/       Jest tests; the network is always mocked
```

`api/` and `core/` never import from `ui/` or `storage/`.

The data flow for one keystroke:

```
input event
  → controller.setQuery(text)            abort the active request, show loading
  → debounce (400 ms)
  → runSearch(query)                     new AbortController for this request
  → cachedSearch(query, signal)          cache hit, shared in-flight request, or a new one
  → searchCountries(query, signal)       fetch + timeout + response.ok + 404
  → mapCountryResponse(raw)              API shape → card data
  → setState(...) → onStateChange        UI renders the new state
```

## 1. Cancelling outdated requests

### The problem

The user types `sp`, pauses, then finishes `spain`. Two requests are sent. If the server answers `sp` more slowly than `spain`, the late `sp` response arrives last and overwrites the correct result for `spain` with an older one. Without real cancellation this race is only a matter of time.

### How it works

[createSearchController.ts](src/core/createSearchController.ts) keeps one variable, `activeRequest: AbortController | null`.

1. **Every request gets its own `AbortController`.** `runSearch` creates it, stores it in `activeRequest` and passes `request.signal` down to the search function.
2. **Every input change aborts the active request at once.** `setQuery` calls `abortActiveRequest()` synchronously, before the debounce timer is even reset. The same happens in `searchNow` (history click) and `retry`. So during the 400 ms debounce wait an outdated request is already cancelled and its response can never be rendered under the new text.
3. **The signal reaches `fetch`.** [searchCountries.ts](src/api/searchCountries.ts) combines the caller's signal with a timeout:

   ```ts
   signal: AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
   ```

   The request stops when either source fires. The caller's signal is not changed by the timeout.

4. **`catch` tells the cases apart.** [classifyError.ts](src/api/classifyError.ts) returns one of five kinds, and the controller handles them separately:

   | Kind      | Comes from                                   | What the user sees                  |
   | --------- | -------------------------------------------- | ----------------------------------- |
   | `abort`   | our own `abort()` (new input, cleared field) | nothing — this is not an error      |
   | `timeout` | `AbortSignal.timeout` (`TimeoutError`)       | error message with a "Retry" button |
   | `http`    | `HttpError` for any non-OK status except 404 | error message with a "Retry" button |
   | `network` | `TypeError: Failed to fetch` (offline, CORS) | error message with a "Retry" button |
   | `unknown` | anything else (for example broken JSON)      | error message with a "Retry" button |

   `AbortError` and `TimeoutError` are both `DOMException`s, so they are distinguished by `name`, not by class. `classifyError` checks the `name` field directly instead of using `instanceof Error`, because a `DOMException` from another realm (Jest, an iframe) fails `instanceof Error`. The tests caught this.

5. **404 is not an error.** countries.dev answers 404 when nothing matches. `searchCountries` checks `status === 404` **before** `response.ok` and returns `[]`; the controller turns an empty list into the friendly `not-found` state. Every other non-OK status throws `HttpError`, because `fetch` itself does not reject on 4xx/5xx.

The type system enforces the "abort is never shown" rule: the error state uses `VisibleErrorKind = Exclude<ErrorKind, 'abort'>` ([types.ts](src/core/types.ts)), so code that tries to render an aborted request as an error does not compile.

### Why abort and not a "is this the latest response?" flag

A flag or a request counter only hides a late response. Abort removes it.

- **The outdated request keeps running with a flag.** It still uses the connection, bandwidth and server time. Browsers limit parallel connections per host (6 over HTTP/1.1), so on a slow network stale requests can delay the one the user is actually waiting for. `abort()` closes the request; DevTools shows it as `(canceled)`.
- **A flag only guards the code someone remembered to guard.** A late response could still write to the cache, add to history or trigger a loading flicker. With abort, the promise rejects with `AbortError` and none of the success code runs.
- **One mechanism covers several cases.** A cleared field, new input, a history click, a retry and the timeout all go through `AbortSignal`. With flags, each case needs its own bookkeeping.
- **It can be tested honestly.** In [raceCondition.test.ts](tests/raceCondition.test.ts) the mocked `fetch` resolves the earlier request **after** the later one and rejects with `signal.reason` when its signal is aborted. The test asserts both that only `spain` is rendered **and** that the `sp` signal was aborted. If `abort()` is removed from the controller, three of the five tests fail.

After `await search(...)` the controller also checks `request.signal.aborted`. This is not a separate flag: it reads the same signal. It covers one narrow case — the search promise has already resolved, but `abort()` was called before the code after `await` got its turn in the microtask queue.

### Cancellation and the shared cache (bonus)

[createCachedSearch.ts](src/core/createCachedSearch.ts) shares one in-flight request between callers that search for the same text. The shared request must not be cancelled by one caller who changed their mind, so:

- the shared request gets the cache's **own** `AbortController`, not the signal of the first caller;
- each caller gets its own promise (`withOwnSignal`) that rejects with `AbortError` when **its** signal aborts, while the shared promise keeps running for the others;
- a `subscribers` counter tracks how many callers still wait. When it drops to zero, the cache calls `abort()` on the shared request, so cancellation still reaches the network and shows up in DevTools;
- a request that every caller abandoned is removed from the in-flight map and never cached.

## 2. Debounce delay — 400 ms

`DEBOUNCE_DELAY_MS = 400` in [constants.ts](src/core/constants.ts). [debounce.ts](src/core/debounce.ts) is a hand-written higher-order function: every call clears the previous timer and starts a new one, so `fn` runs once, `delay` ms after the **last** call, with the last arguments.

**Why 400 ms.** Most people type with 150–300 ms between keystrokes inside a word. A delay above that range means "the user paused", not "the user is between two letters". 400 ms is long enough that typing `spain` at a normal pace sends one request instead of five, and short enough that results still appear "as you type".

**If debounce is removed:**

- every keystroke sends a request — `spain` makes 5 requests, 4 of them aborted right away;
- the API gets several times more traffic and is more likely to answer `429 Too Many Requests`, which the user would see as an error;
- short prefixes such as `s` or `sp` return long lists that are thrown away a moment later;
- the results area flickers between loading and partial results.

Correctness would not break — abort still cancels every outdated request — but the app would do a lot of useless work.

**If the delay is made much longer (for example 1.5 s):**

- the search stops feeling live: the user finishes typing and nothing happens for a noticeable moment;
- people tend to press keys again or assume the app is broken;
- fewer requests are saved than it seems, because people pause between words anyway.

**Feedback during the wait.** `setQuery` switches to the `loading` state immediately on input, so the user sees that the app reacted even before the request is sent. A click on a history item calls `searchNow`, which skips the debounce, because the user has already chosen the exact query.

## 3. Complexity

### `mapCountryResponse(raw)`

[mapCountryResponse.ts](src/core/mapCountryResponse.ts)

Let `L` be the number of languages, `C` the number of currencies and `B` the number of borders of one country.

- **Time: O(L + C + B).** Scalar fields (`name`, `capital`, `population`, ...) are copied in O(1) each. `languages.map`, `currencies.map` and the `borders` copy walk each array once.
- **Extra space: O(L + C + B)** for the three new arrays. The input is never mutated, and the output shares no arrays with it.

For the whole response of `N` countries, `searchCountries` calls it once per country: **O(N · (L + C + B))**, which is linear in the size of the JSON. Parsing the JSON (`response.json()`) is also linear in the response size, so mapping does not change the overall order. In practice `L`, `C` and `B` are small (Spain: 1, 1, 5), so mapping is O(N).

### `createCachedSearch` — cache and deduplication (bonus)

[createCachedSearch.ts](src/core/createCachedSearch.ts). Let `q` be the query length, `E` the number of cached entries (`E ≤ maxEntries = 50`) and `K` the number of countries in one result.

| Operation                           | Time         | Why                                                                  |
| ----------------------------------- | ------------ | -------------------------------------------------------------------- |
| Build the key (`toLowerCase`)       | O(q)         | one pass over the query                                              |
| Cache hit                           | O(1) average | `Map.get`, then `delete` + `set` to mark the entry as recently used  |
| Store a result and evict the oldest | O(1) average | `Map` keeps insertion order; the oldest key is `cache.keys().next()` |
| Join an in-flight request           | O(1) average | `Map.get` + increment the `subscribers` counter                      |
| Caller aborts                       | O(1)         | decrement the counter; abort the shared request when it reaches zero |

- **Memory:** O(E · K) for cached results plus O(P) for `P` requests in flight. The `maxEntries` limit keeps memory bounded however long the page stays open.
- **Network:** without deduplication, `n` identical concurrent searches send `n` requests; with it they send one. A repeated search after the first answer sends zero.

A `Map` is used instead of a plain object because it is built for key–value lookups, has no inherited keys and keeps insertion order, which makes the LRU eviction a single `keys().next()` call.

### Other functions

| Function              | Time          | Notes                                                              |
| --------------------- | ------------- | ------------------------------------------------------------------ |
| `debounce` wrapper    | O(1) per call | one `clearTimeout` and one `setTimeout`                            |
| `classifyError`       | O(1)          | a fixed number of checks                                           |
| `addToHistory`        | O(H)          | one `filter` over the history, `H ≤ HISTORY_LIMIT = 5`             |
| `loadHistory`         | O(S)          | parse and filter a stored array of size `S`                        |
| Rendering the results | O(N)          | one card per country; `replaceChildren` swaps the list in one call |

## 4. Clean code principles

**Single responsibility.** Each module does one job.

- [searchCountries.ts](src/api/searchCountries.ts) only talks HTTP: build the URL, call `fetch`, check the status, parse JSON. Building the URL is its own small function, `buildSearchUrl`.
- [mapCountryResponse.ts](src/core/mapCountryResponse.ts) only converts the API shape to card data.
- [classifyError.ts](src/api/classifyError.ts) only decides what kind of error happened. It does not show anything.
- [createCachedSearch.ts](src/core/createCachedSearch.ts) only caches and deduplicates; it knows nothing about `fetch` or the DOM.
- [createSearchController.ts](src/core/createSearchController.ts) only orchestrates: debounce, cancel, call the search, turn the outcome into a state.
- [historyStorage.ts](src/storage/historyStorage.ts) only reads and writes `localStorage`; [searchHistory.ts](src/core/searchHistory.ts) holds the history rules.
- In the UI, [modal.ts](src/ui/modal.ts) is a reusable modal that knows nothing about countries, [countryCard.ts](src/ui/countryCard.ts) renders one card, [searchResults.ts](src/ui/searchResults.ts) maps a state to markup.

**Dependency injection.** Dependencies are passed in, not hard-coded.

- `createSearchController({ search, delay, onStateChange })` — tests pass a `jest.fn()` instead of the network and a custom delay; the app passes `createCachedSearch(searchCountries)` ([app.ts](src/ui/app.ts)).
- `loadHistory(storage = localStorage)` and `saveHistory(history, storage)` — tests pass an in-memory storage or one that throws.
- `createCachedSearch(search, { maxEntries })` wraps any function with the `SearchFn` signature.

**Higher-order functions and decorators.** `debounce(fn, delay)` returns a new function with the same arguments. `createCachedSearch(search)` returns a function with the same `SearchFn` signature as `searchCountries`, so the controller cannot tell whether it is talking to the network or the cache.

**Pure functions and immutability.** `mapCountryResponse`, `addToHistory`, `classifyError` and everything in [format.ts](src/core/format.ts) depend only on their arguments and never change them. `mapCountryResponse` copies `borders` instead of sharing the array; `addToHistory` builds a new array with `filter` and spread, and returns the **same** array when nothing changes. Every state change creates a new state object.

**Types that make invalid states impossible.** `SearchState` is a discriminated union ([types.ts](src/core/types.ts)): `countries` exists only in `success`, `errorKind` only in `error`, and `renderSearchState` switches on `status`. `ErrorKind` is a union of string literals, and `VisibleErrorKind` removes `'abort'` from it. `RawCountry` marks the fields countries.dev sometimes omits (`capital?`, `area?`, `borders?`, `currencies?`), and `Country` replaces them with explicit `null` or `[]`, so the UI never meets `undefined`.

**Explicit error handling.** `HttpError` is a custom class that extends `Error` and stores `status` ([HttpError.ts](src/api/HttpError.ts)). Caught values are typed as `unknown` and checked before use (`hasErrorName` in [classifyError.ts](src/api/classifyError.ts), `isString` in [historyStorage.ts](src/storage/historyStorage.ts)), so a corrupted `localStorage` value or a strange thrown value cannot crash the app.

**Guard clauses.** `runSearch`, `setQuery`, `searchNow` and `retry` in the controller start with early returns for empty or outdated queries, so the main path has no nesting. `close` in [modal.ts](src/ui/modal.ts) returns early when the modal is already closed.

**No magic values.** `API_BASE_URL`, `REQUEST_TIMEOUT_MS` and `NOT_FOUND_STATUS` live in [api/constants.ts](src/api/constants.ts); `DEBOUNCE_DELAY_MS` and `HISTORY_LIMIT` in [core/constants.ts](src/core/constants.ts); error texts in [messages.ts](src/ui/messages.ts). Colors, radii and shadows are SCSS variables in [\_variables.scss](src/styles/abstracts/_variables.scss).

**DRY.** `createElement` in [dom.ts](src/ui/dom.ts) is the only way the UI creates elements. `createFlag` is shared by the card and the details view. The tile header, the sticker and the soft card look are written once (`.tile`, `.sticker`, `soft-card` and `label-caps` mixins in [\_mixins.scss](src/styles/abstracts/_mixins.scss)) and reused across components.

**Safe DOM output.** No `innerHTML` or `insertAdjacentHTML`. All dynamic content is set through `textContent` via `createElement`, so a country name can never be interpreted as HTML.

**Accessibility.** The results container has `aria-live="polite"`; loading uses `role="status"` and errors `role="alert"`. The modal ([modal.ts](src/ui/modal.ts)) has `role="dialog"`, `aria-modal` and `aria-labelledby`, makes the rest of the page `inert`, closes on Escape and backdrop click, and returns focus to the card that opened it. The whole card is clickable, but for the keyboard it is a single labelled button ("More details about Spain").

**Tests that follow FIRST.** Tests in [tests/](tests) are **f**ast (no real network or timers: `fetch` is mocked, `jest.useFakeTimers` drives the debounce, `AbortSignal.timeout` is replaced by a controllable signal), **i**ndependent (each test creates its own mocks and controller, `afterEach` restores them), **r**epeatable (fixtures are saved real API responses in [tests/fixtures/](tests/fixtures)), **s**elf-validating (every test asserts with `expect`) and **t**imely (each test commit comes before its implementation commit).

**Consistent style, enforced by tools.** ESLint ([eslint.config.js](eslint.config.js)) enforces `eqeqeq`, `curly`, `prefer-const`, `no-var` and bans `any`. Prettier ([.prettierrc](.prettierrc)) formats every file. Husky runs `lint-staged` before every commit and `npm test` before every push, so red tests cannot be pushed.
