# `key.js`

Functionality that is only concerned with a single key.


## The `Key` class

Represents a single key. It is a wrapper around an integer. Only the first 13 bits are used:
- 0-7:  the keycode
- 8-12: flags like shift and control


## `function keyEventToKey`

Construct a `Key` given a `KeyboardEvent` such as those passed to
`window.onkeydown` and `window.onkeyup`.

It tries to fix the issue of lowercase letters being indistinguishable from
uppercase letters. See comments in the code for more details.


## `window.keydown` and `window.keyup`

Replaces the vanilla `window.onkeydown` and `window.onkeyup` events.
The rather than being passed `KeyboardEvent`s, the functions are passed:
- A `Key`
- Time in milliseconds since page-load
- A boolean whether this event was caused by key repeat


### About the key repeat boolean:

`KeyboardEvent.repeat` is always false for any key that would have an effect if typed into a textbox.
Instead, when a key is released we wait 4ms in case it is re-pressed, in which case we cancel the
`keyup` event and assume this must be repeat.

4ms was arbitrarily chosen. See comments in the code for rationale and test results.


## `window.parseKeys`

Parses a sequence of keys given in a vim-like format:

```
Foo         -> F, o, o
<esc>       -> Escape
<c-f>oo     -> ctrl+f, o, o
<c-a-m-esc> -> ctrl+alt+meta+escape
```
